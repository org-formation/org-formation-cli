import * as IAM from '@aws-sdk/client-iam';
import * as Organizations from '@aws-sdk/client-organizations';
import * as Support from '@aws-sdk/client-support';
import * as STS from '@aws-sdk/client-sts';
import * as Account from "@aws-sdk/client-account";
import { AwsUtil } from '../util/aws-util';
import { ConsoleUtil } from '../util/console-util';
import { GetOrganizationAccessRoleInTargetAccount, ICrossAccountConfig } from './aws-account-access';
import { performAndRetryIfNeeded } from './util';

export type AWSObjectType = 'Account' | 'OrganizationalUnit' | 'Policy' | string;
export interface OptInRegion {
    RegionName?: string;
}

export type OptInRegions = OptInRegion[];

export type SupportLevel = 'enterprise' | 'business' | 'developer' | 'basic' | string;
interface IAWSTags {
    [key: string]: string;
}
interface IAWSAccountWithTags {
    Tags?: IAWSTags;
}

interface IAWSObjectWithPartition {
    PartitionArn?: string;
    PartitionId?: string;
}

interface IAWSAccountWithIAMAttributes {
    Alias?: string;
    PartitionAlias?: string;
    PasswordPolicy?: IAM.PasswordPolicy;
}

interface IAWSAccountWithSupportLevel {
    SupportLevel?: SupportLevel;
}

interface IAWSAccountWithOptinRegions {
    OptInRegions?: OptInRegions;
}

interface IObjectWithParentId {
    ParentId: string;
}

export interface IAWSObject {
    Type: AWSObjectType;
    Id: string;
    Name: string;
}

interface IObjectWithAccounts {
    Accounts: AWSAccount[];
}
interface IObjectWitOrganizationalUnits {
    OrganizationalUnits: AWSOrganizationalUnit[];
}

interface IObjectWithPolicies {
    Policies: AWSPolicy[];
}

interface IPolicyTargets {
    Targets: Organizations.PolicyTargetSummary[];
}

export type AWSPolicy = Organizations.Policy & IPolicyTargets & IAWSObject;
export type AWSAccount = Organizations.Account & IAWSAccountWithTags & IAWSAccountWithSupportLevel & IAWSAccountWithOptinRegions & IAWSAccountWithIAMAttributes & IObjectWithParentId & IObjectWithPolicies & IAWSObject & IAWSObjectWithPartition;
export type AWSOrganizationalUnit = Organizations.OrganizationalUnit & IObjectWithParentId & IObjectWithPolicies & IObjectWithAccounts & IAWSObject & IObjectWitOrganizationalUnits & IAWSObjectWithPartition;
export type AWSRoot = Organizations.Root & IObjectWithPolicies & IObjectWitOrganizationalUnits;

const GetPoliciesForTarget = (list: AWSPolicy[], targetId: string, targetType: Organizations.TargetType): AWSPolicy[] => {
    return list.filter(x => x.Targets.find(y => y.TargetId === targetId && y.Type === targetType));
};

export class AwsOrganizationReader {

    private static async getOrganization(that: AwsOrganizationReader): Promise<Organizations.Organization> {

        const describeOrgCommand = new Organizations.DescribeOrganizationCommand({});
        const resp = await performAndRetryIfNeeded(() => that.organizationsService.send(describeOrgCommand));
        if (resp.Organization.Arn.split(':')[1] === 'aws-us-gov') {
            that.isPartition = true;
        }
        return resp.Organization;
    }

    private static async listPolicies(that: AwsOrganizationReader): Promise<AWSPolicy[]> {
        try {
            const result: AWSPolicy[] = [];

            const listPoliciesReq: Organizations.ListPoliciesCommandInput = {
                Filter: 'SERVICE_CONTROL_POLICY',
            };

            let resp: Organizations.ListPoliciesCommandOutput;
            do {
                const listPoliciesCommand = new Organizations.ListPoliciesCommand(listPoliciesReq);
                resp = await performAndRetryIfNeeded(() => that.organizationsService.send(listPoliciesCommand));
                for (const policy of resp.Policies) {

                    const describePolicyCommand = new Organizations.DescribePolicyCommand({
                        PolicyId: policy.Id,
                    });

                    const describedPolicy = await performAndRetryIfNeeded(() => that.organizationsService.send(describePolicyCommand));

                    const awsPolicy = {
                        ...describedPolicy.Policy,
                        Type: 'Policy',
                        Name: policy.Name,
                        Id: policy.Id,
                        Targets: [] as Organizations.PolicyTargetSummary[],
                    };

                    result.push(awsPolicy);

                    const listTargetsReq: Organizations.ListTargetsForPolicyCommandInput ={
                        PolicyId: policy.Id,
                    };
                    let listTargetsResp: Organizations.ListTargetsForPolicyCommandOutput;
                    do {
                        const listTargetsCommand = new Organizations.ListTargetsForPolicyCommand(listTargetsReq);
                        listTargetsResp = await performAndRetryIfNeeded(() => that.organizationsService.send(listTargetsCommand));
                        awsPolicy.Targets.push(...listTargetsResp.Targets);
                        listTargetsReq.NextToken = listTargetsResp.NextToken;
                    } while (listTargetsReq.NextToken);
                }
                listPoliciesReq.NextToken = resp.NextToken;
            } while (resp.NextToken);

            return result;
        } catch (err) {
            ConsoleUtil.LogError('unable to list policies', err);
            throw err;
        }
    }

    public static async listRoots(that: AwsOrganizationReader): Promise<AWSRoot[]> {
        try {
            const policies: AWSPolicy[] = await that.policies.getValue();
            const result: AWSRoot[] = [];
            let resp: Organizations.ListRootsCommandOutput;
            const req: Organizations.ListRootsCommandInput = {};

            do {
                const command = new Organizations.ListRootsCommand(req);
                resp = await performAndRetryIfNeeded(() => that.organizationsService.send(command));
                req.NextToken = resp.NextToken;
                for (const root of resp.Roots) {
                    const item: AWSRoot = {
                        ...root,
                        Policies: GetPoliciesForTarget(policies, root.Id, 'ROOT'),
                        OrganizationalUnits: [],
                    };
                    result.push(item);
                }
            } while (resp.NextToken);

            return result;
        } catch (err) {
            ConsoleUtil.LogError('unable to list roots', err);
            throw err;
        }
    }

    private static async listOrganizationalUnits(that: AwsOrganizationReader): Promise<AWSOrganizationalUnit[]> {
        try {
            const roots: AWSRoot[] = await that.roots.getValue();
            const policies: AWSPolicy[] = await that.policies.getValue();
            const rootsIds: string[] = [];
            const result: AWSOrganizationalUnit[] = [];
            rootsIds.push(...roots.map(x => x.Id!));

            do {
                const req: Organizations.ListOrganizationalUnitsForParentCommandInput = {
                    ParentId: rootsIds.pop(),
                };
                let resp: Organizations.ListOrganizationalUnitsForParentCommandOutput;
                do {
                    const command = new Organizations.ListOrganizationalUnitsForParentCommand(req);
                    resp = await performAndRetryIfNeeded(() => that.organizationsService.send(command));
                    req.NextToken = resp.NextToken;
                    if (!resp.OrganizationalUnits) { continue; }

                    for (const ou of resp.OrganizationalUnits) {
                        if (ou.Id === req.ParentId) { continue; }
                        const organization: AWSOrganizationalUnit = {
                            ...ou,
                            Type: 'OrganizationalUnit',
                            Name: ou.Name,
                            Id: ou.Id!,
                            ParentId: req.ParentId,
                            Accounts: [] as AWSAccount[],
                            Policies: GetPoliciesForTarget(policies, ou.Id, 'ORGANIZATIONAL_UNIT'),
                            OrganizationalUnits: [],
                        };

                        result.push(organization);
                        // Only add unique values to avoid infinite loop
                        if (rootsIds.indexOf(organization.Id) === -1) {
                            rootsIds.push(organization.Id);
                        }
                    }

                } while (resp.NextToken);
            } while (rootsIds.length > 0);

            for (const ou of result) {
                let parentToOU: IObjectWitOrganizationalUnits = roots.find(x => x.Id === ou.ParentId);
                if (parentToOU === undefined) {
                    parentToOU = result.find(x => x.Id === ou.ParentId);
                }
                if (parentToOU === undefined) {
                    ConsoleUtil.LogWarning(`found organizational unit of which parent could not be found: ${ou.Name} (parent: ${ou.ParentId})`);
                    continue;
                }
                parentToOU.OrganizationalUnits.push(ou);
            }

            return result;
        } catch (err) {
            ConsoleUtil.LogError('unable to list organizational units', err);
            throw err;
        }
    }

    private static async listAccounts(that: AwsOrganizationReader, excludeAccountIds: string[]): Promise<AWSAccount[]> {
        try {
            const roots: AWSRoot[] = await that.roots.getValue();
            const policies: AWSPolicy[] = await that.policies.getValue();
            const organizationalUnits: AWSOrganizationalUnit[] = await that.organizationalUnits.getValue();
            const result: AWSAccount[] = [];
            const parentIds = organizationalUnits.map(x => x.Id);
            const rootIds = roots.map(x => x.Id);
            parentIds.push(...rootIds);

            do {
                const req: Organizations.ListAccountsForParentCommandInput = {
                    ParentId: parentIds.pop(),
                };
                let resp: Organizations.ListAccountsCommandOutput;
                do {
                    const command = new Organizations.ListAccountsForParentCommand(req);
                    resp = await performAndRetryIfNeeded(() => that.organizationsService.send(command));
                    req.NextToken = resp.NextToken;
                    const accounts = resp.Accounts?.filter(x=>!excludeAccountIds.includes(x.Id));

                    const getAccount = async (acc: Organizations.Account): Promise<void> => {
                        if (acc.Status === 'SUSPENDED') {
                            return;
                        }

                        let tags: IAWSTags = {};
                        let alias: string;
                        let passwordPolicy: IAM.PasswordPolicy;
                        let supportLevel = 'basic';
                        let optInRegions: OptInRegions;

                        try {
                            [tags, alias, passwordPolicy, supportLevel, optInRegions] = await Promise.all([
                                AwsOrganizationReader.getTagsForAccount(that, acc.Id),
                                AwsOrganizationReader.getIamAliasForAccount(that, acc.Id),
                                AwsOrganizationReader.getIamPasswordPolicyForAccount(that, acc.Id),
                                AwsOrganizationReader.getSupportLevelForAccount(that, acc.Id),
                                AwsOrganizationReader.getOptInRegionsForAccount(that, acc.Id),
                            ]);

                        } catch (err) {
                            if (err instanceof STS.STSServiceException) {
                                ConsoleUtil.LogWarning(`AccessDenied: unable to log into account ${acc.Id}. This might have various causes, to troubleshoot:`
                                    + '\nhttps://github.com/OlafConijn/AwsOrganizationFormation/blob/master/docs/access-denied.md');
                            } else {
                                throw err;
                            }
                        }

                        const account = {
                            ...acc,
                            Type: (that.isPartition) ? 'PartitionAccount' : 'Account',
                            Name: acc.Name,
                            Id: acc.Id,
                            ParentId: req.ParentId,
                            Policies: GetPoliciesForTarget(policies, acc.Id, 'ORGANIZATIONAL_UNIT'),
                            Tags: tags,
                            Alias: alias,
                            PasswordPolicy: passwordPolicy,
                            SupportLevel: supportLevel,
                            OptInRegions: optInRegions,
                        };

                        const parentOU = organizationalUnits.find(x => x.Id === req.ParentId);
                        if (parentOU) {
                            parentOU.Accounts.push(account);
                        }
                        result.push(account);
                    };
                    await Promise.all(accounts.map(getAccount));

                } while (resp.NextToken);

            } while (parentIds.length > 0);

            return result;
        } catch (err) {
            ConsoleUtil.LogError('unable to list accounts', err);
            throw err;
        }
    }

    private static async getOptInRegionsForAccount(that: AwsOrganizationReader, accountId: string): Promise<OptInRegions> {
        try {
            await that.organization.getValue();
            const targetRoleConfig = await GetOrganizationAccessRoleInTargetAccount(that.crossAccountConfig, accountId);
            const accountClient: Account.AccountClient = AwsUtil.GetAccountService(accountId, targetRoleConfig.role, targetRoleConfig.viaRole, that.isPartition);

            const command = await accountClient.send( new Account.ListRegionsCommand({RegionOptStatusContains: ["ENABLED"],}));
            return command.Regions;
        } catch (err) {
            if (err instanceof Account.AccountServiceException) {
                return undefined;
            }
            throw err;
        }
    }    

    private static async getSupportLevelForAccount(that: AwsOrganizationReader, accountId: string): Promise<SupportLevel> {
        try {
            await that.organization.getValue();
            const targetRoleConfig = await GetOrganizationAccessRoleInTargetAccount(that.crossAccountConfig, accountId);
            const supportClient: Support.SupportClient = AwsUtil.GetSupportService(accountId, targetRoleConfig.role, targetRoleConfig.viaRole, that.isPartition);

            const severityLevels = await supportClient.send( new Support.DescribeSeverityLevelsCommand({}));
            const critical = severityLevels.severityLevels.find(x => x.code === 'critical');
            if (critical !== undefined) {
                return 'enterprise';
            }
            const urgent = severityLevels.severityLevels.find(x => x.code === 'urgent');
            if (urgent !== undefined) {
                return 'business';
            }
            return 'developer';
        } catch (err) {
            if (err instanceof Support.SupportServiceException) {
                return 'basic';
            }
            throw err;
        }
    }

    private static async getIamAliasForAccount(that: AwsOrganizationReader, accountId: string): Promise<string> {
        try {
            await that.organization.getValue();
            const targetRoleConfig = await GetOrganizationAccessRoleInTargetAccount(that.crossAccountConfig, accountId);
            const iamService: IAM.IAMClient = AwsUtil.GetIamService(accountId, targetRoleConfig.role, targetRoleConfig.viaRole, that.isPartition);

            const response = await iamService.send(new IAM.ListAccountAliasesCommand({ MaxItems: 1 }));
            if (response && response.AccountAliases && response.AccountAliases.length >= 1) {
                return response.AccountAliases[0];
            } else {
                return undefined;
            }
        } catch (err) {
            ConsoleUtil.LogDebug(`unable to get iam alias for account ${accountId}\nerr: ${err}`);
            throw err;
        }
    }

    private static async getIamPasswordPolicyForAccount(that: AwsOrganizationReader, accountId: string): Promise<IAM.PasswordPolicy> {
        try {
            await that.organization.getValue();
            const targetRoleConfig = await GetOrganizationAccessRoleInTargetAccount(that.crossAccountConfig, accountId);
            const iamService: IAM.IAMClient = AwsUtil.GetIamService(accountId, targetRoleConfig.role, targetRoleConfig.viaRole, that.isPartition);

            try {
                const response = await iamService.send(new IAM.GetAccountPasswordPolicyCommand({}));
                return response.PasswordPolicy;
            } catch (err) {
                if (err instanceof IAM.NoSuchEntityException) {
                    return undefined;
                }
                throw err;
            }
        } catch (err) {
            ConsoleUtil.LogDebug(`unable to get password policy for account ${accountId}\nerr: ${err}`);
            throw err;
        }
    }

    private static async getTagsForAccount(that: AwsOrganizationReader, accountId: string): Promise<IAWSTags> {
        try {
            const listTagsForResourceCommand = new Organizations.ListTagsForResourceCommand({
                ResourceId: accountId,
            });
            const response = await performAndRetryIfNeeded(() => that.organizationsService.send(listTagsForResourceCommand));
            const tags: IAWSTags = {};
            for (const tag of response.Tags) {
                tags[tag.Key] = tag.Value;
            }
            return tags;
        } catch (err) {
            ConsoleUtil.LogError('unable to list tags for account ' + accountId, err);
            throw err;
        }
    }

    public readonly policies: Lazy<AWSPolicy[]>;
    public readonly accounts: Lazy<AWSAccount[]>;
    public readonly organizationalUnits: Lazy<AWSOrganizationalUnit[]>;
    public readonly organization: Lazy<Organizations.Organization>;
    public static excludeAccountIds: string[] = [];
    public readonly roots: Lazy<AWSRoot[]>;
    private readonly organizationsService: Organizations.OrganizationsClient;
    private isPartition: boolean;

    constructor(organizationsService: Organizations.OrganizationsClient, private readonly crossAccountConfig?: ICrossAccountConfig) {

        this.organizationsService = organizationsService;
        this.policies = new Lazy(this, AwsOrganizationReader.listPolicies);
        this.organizationalUnits = new Lazy(this, AwsOrganizationReader.listOrganizationalUnits);
        this.accounts = new Lazy(this, x=> AwsOrganizationReader.listAccounts(x, AwsOrganizationReader.excludeAccountIds));
        this.organization = new Lazy(this, AwsOrganizationReader.getOrganization);
        this.roots = new Lazy(this, AwsOrganizationReader.listRoots);
        this.isPartition = false;
    }
}

class Lazy<T> {
    private cachedValue: T | undefined;
    private promise: Promise<T>;
    private valueTimestamp: Date | undefined;
    private obtainValueFn: (that: AwsOrganizationReader) => Promise<T>;
    private that: AwsOrganizationReader;

    constructor(that: AwsOrganizationReader, obtainValueFn: (that: AwsOrganizationReader) => Promise<T>) {
        this.that = that;
        this.obtainValueFn = obtainValueFn;
    }

    public async getValue(since?: Date): Promise<T> {
        if (this.cachedValue) {
            if (!since || since < this.valueTimestamp) {
                return this.cachedValue;
            }
        }
        if (!this.promise) {
            this.promise = this.obtainValueFn(this.that);
        }
        this.cachedValue = await this.promise;
        this.valueTimestamp = new Date();
        return this.cachedValue;
    }
}
