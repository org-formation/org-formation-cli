import { IAM, Organizations, STS } from 'aws-sdk/clients/all';
import { Account, Accounts, ListAccountsForParentRequest, ListAccountsRequest, ListAccountsResponse, ListOrganizationalUnitsForParentRequest, ListOrganizationalUnitsForParentResponse, ListPoliciesRequest, ListPoliciesResponse, ListRootsRequest, ListRootsResponse, ListTagsForResourceRequest, ListTargetsForPolicyRequest, ListTargetsForPolicyResponse, Organization, OrganizationalUnit, Policy, PolicyTargetSummary, Root, TargetType } from 'aws-sdk/clients/organizations';
import { CredentialsOptions } from 'aws-sdk/lib/credentials';
import { AwsUtil } from '../util/aws-util';
import { ConsoleUtil } from '../util/console-util';
import { GetOrganizationAccessRoleInTargetAccount, ICrossAccountConfig } from './aws-account-access';
import { performAndRetryIfNeeded } from './util';

export type AWSObjectType = 'Account' | 'OrganizationalUnit' | 'Policy' | string;

export type SupportLevel = 'enterprise' | 'business' | 'developer' | 'basic' | string;
interface IAWSTags {
    [key: string]: string;
}
interface IAWSAccountWithTags {
    Tags?: IAWSTags;
}

interface IAWSAccountWithPartition {
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
    Targets: PolicyTargetSummary[];
}

export type AWSPolicy = Policy & IPolicyTargets & IAWSObject;
export type AWSAccount = Account & IAWSAccountWithPartition & IAWSAccountWithTags & IAWSAccountWithSupportLevel & IAWSAccountWithIAMAttributes & IObjectWithParentId & IObjectWithPolicies & IAWSObject & IAWSAccountWithPartition;
export type AWSOrganizationalUnit = OrganizationalUnit & IObjectWithParentId & IObjectWithPolicies & IObjectWithAccounts & IAWSObject & IObjectWitOrganizationalUnits;
export type AWSRoot = Root & IObjectWithPolicies & IObjectWitOrganizationalUnits;

const GetPoliciesForTarget = (list: AWSPolicy[], targetId: string, targetType: TargetType): AWSPolicy[] => {
    return list.filter(x => x.Targets.find(y => y.TargetId === targetId && y.Type === targetType));
};

export class AwsOrganizationReader {

    private partitionOrgService: Organizations;
    private partitionOrgSTS: STS;

    private static async getOrganization(that: AwsOrganizationReader): Promise<Organization> {

        const resp = await performAndRetryIfNeeded(() => that.organizationService.describeOrganization().promise());
        return resp.Organization;
    }

    private static async listPolicies(that: AwsOrganizationReader): Promise<AWSPolicy[]> {
        try {
            const result: AWSPolicy[] = [];
            const req: ListPoliciesRequest = {
                Filter: 'SERVICE_CONTROL_POLICY',
            };
            let resp: ListPoliciesResponse;
            do {
                resp = await performAndRetryIfNeeded(() => that.organizationService.listPolicies(req).promise());
                for (const policy of resp.Policies) {

                    const describedPolicy = await performAndRetryIfNeeded(() => that.organizationService.describePolicy({ PolicyId: policy.Id }).promise());

                    const awsPolicy = {
                        ...describedPolicy.Policy,
                        Type: 'Policy',
                        Name: policy.Name,
                        Id: policy.Id,
                        Targets: [] as PolicyTargetSummary[],
                    };

                    result.push(awsPolicy);

                    const listTargetsReq: ListTargetsForPolicyRequest = {
                        PolicyId: policy.Id,
                    };
                    let listTargetsResp: ListTargetsForPolicyResponse;
                    do {
                        listTargetsResp = await performAndRetryIfNeeded(() => that.organizationService.listTargetsForPolicy(listTargetsReq).promise());
                        awsPolicy.Targets.push(...listTargetsResp.Targets);
                        listTargetsReq.NextToken = listTargetsResp.NextToken;
                    } while (listTargetsReq.NextToken);
                }
                req.NextToken = resp.NextToken;
            } while (resp.NextToken);

            return result;
        } catch (err) {
            ConsoleUtil.LogError('unable to list policies', err);
            throw err;
        }
    }

    private static async listRoots(that: AwsOrganizationReader): Promise<AWSRoot[]> {
        try {
            const result: AWSRoot[] = [];
            const policies = await that.policies.getValue();
            let resp: ListRootsResponse;
            const req: ListRootsRequest = {};
            do {
                resp = await performAndRetryIfNeeded(() => that.organizationService.listRoots(req).promise());
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
            const rootsIds: string[] = [];
            const result: AWSOrganizationalUnit[] = [];

            const policies = await that.policies.getValue();
            const roots = await that.roots.getValue();
            rootsIds.push(...roots.map(x => x.Id!));

            do {
                const req: ListOrganizationalUnitsForParentRequest = {
                    ParentId: rootsIds.pop(),
                };
                let resp: ListOrganizationalUnitsForParentResponse;
                do {
                    resp = await performAndRetryIfNeeded(() => that.organizationService.listOrganizationalUnitsForParent(req).promise());
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

    private static async listAccounts(that: AwsOrganizationReader): Promise<AWSAccount[]> {
        try {
            const result: AWSAccount[] = [];
            const organizationalUnits = await that.organizationalUnits.getValue();
            const policies = await that.policies.getValue();
            const roots = await that.roots.getValue();
            const parentIds = organizationalUnits.map(x => x.Id);
            const rootIds = roots.map(x => x.Id);
            const partitionCreds = await AwsUtil.GetPartitionCredentials();
            parentIds.push(...rootIds);

            do {
                const req: ListAccountsForParentRequest = {
                    ParentId: parentIds.pop(),
                };
                let resp: ListAccountsResponse;
                do {
                    resp = await performAndRetryIfNeeded(() => that.organizationService.listAccountsForParent(req).promise());

                    let gcResp: ListAccountsResponse;
                    let partitionAccList: Accounts = [];

                    if (partitionCreds) {
                        const gcOrg = new Organizations({ region: AwsUtil.GetPartitionRegion(), credentials: partitionCreds });
                        const partitionReq: ListAccountsRequest = {};
                        do {
                            gcResp = await gcOrg.listAccounts(partitionReq).promise();
                            partitionAccList = partitionAccList.concat(gcResp.Accounts);
                            partitionReq.NextToken = gcResp.NextToken;
                        } while (gcResp.NextToken);

                    }
                    req.NextToken = resp.NextToken;

                    for (const acc of resp.Accounts) {
                        if (acc.Status === 'SUSPENDED') {
                            continue;
                        }

                        let gcAccount: Account = {};
                        if (partitionAccList) {
                            partitionAccList.forEach(gc => {
                                if (gc.Name === acc.Name) {
                                    gcAccount = gc;
                                }
                            });
                        }

                        let tags: IAWSTags = {};
                        let alias: string;
                        let passwordPolicy: IAM.PasswordPolicy;
                        let supportLevel = 'basic';
                        let partitionAlias: string;

                        try {
                            [tags, alias, passwordPolicy, supportLevel] = await Promise.all([
                                AwsOrganizationReader.getTagsForAccount(that, acc.Id),
                                AwsOrganizationReader.getIamAliasForAccount(that, acc.Id),
                                AwsOrganizationReader.getIamPasswordPolicyForAccount(that, acc.Id),
                                AwsOrganizationReader.getSupportLevelForAccount(that, acc.Id),
                            ]);

                            if (gcAccount.Id) {
                                partitionAlias = await AwsOrganizationReader.getIamAliasForPartitionAccount(that, gcAccount.Id);
                            }


                        } catch (err) {
                            if (err.code === 'AccessDenied') {
                                ConsoleUtil.LogWarning(`AccessDenied: unable to log into account ${acc.Id}. This might have various causes, to troubleshoot:`
                                    + '\nhttps://github.com/OlafConijn/AwsOrganizationFormation/blob/master/docs/access-denied.md');
                            } else {
                                throw err;
                            }
                        }

                        const account = {
                            ...acc,
                            Type: 'Account',
                            Name: acc.Name,
                            Id: acc.Id,
                            ParentId: req.ParentId,
                            Policies: GetPoliciesForTarget(policies, acc.Id, 'ORGANIZATIONAL_UNIT'),
                            Tags: tags,
                            Alias: alias,
                            PasswordPolicy: passwordPolicy,
                            SupportLevel: supportLevel,
                            PartitionAlias: partitionAlias,
                            PartitionId: gcAccount.Id,
                        };

                        const parentOU = organizationalUnits.find(x => x.Id === req.ParentId);
                        if (parentOU) {
                            parentOU.Accounts.push(account);
                        }
                        result.push(account);
                    }

                } while (resp.NextToken);

            } while (parentIds.length > 0);

            return result;
        } catch (err) {
            ConsoleUtil.LogError('unable to list accounts', err);
            throw err;
        }
    }

    private static async getSupportLevelForAccount(that: AwsOrganizationReader, accountId: string): Promise<SupportLevel> {
        await that.organization.getValue();
        try {
            const targetRoleConfig = await GetOrganizationAccessRoleInTargetAccount(that.crossAccountConfig, accountId);
            const supportService = await AwsUtil.GetSupportService(accountId, targetRoleConfig.role, targetRoleConfig.viaRole);
            const severityLevels = await supportService.describeSeverityLevels().promise();
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
            if (err.code === 'SubscriptionRequiredException') {
                return 'basic';
            }
            throw err;
        }
    }

    private static async getIamAliasForAccount(that: AwsOrganizationReader, accountId: string): Promise<string> {
        try {
            await that.organization.getValue();
            const targetRoleConfig = await GetOrganizationAccessRoleInTargetAccount(that.crossAccountConfig, accountId);
            const iamService = await AwsUtil.GetIamService(accountId, targetRoleConfig.role, targetRoleConfig.viaRole);
            const response = await iamService.listAccountAliases({ MaxItems: 1 }).promise();
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

    private static async getIamAliasForPartitionAccount(that: AwsOrganizationReader, accountId: string): Promise<string> {
        try {

            const assumeParams = {
                RoleArn: `arn:aws-us-gov:iam::${accountId}:role/OrganizationAccountAccessRole`,
                RoleSessionName: 'AssumeRoleSession',
            };
            const role = await that.partitionOrgSTS.assumeRole(assumeParams).promise();

            const iam = new IAM({
                credentials: {
                    accessKeyId: role.Credentials.AccessKeyId,
                    secretAccessKey: role.Credentials.SecretAccessKey,
                    sessionToken: role.Credentials.SessionToken,
                },
                region: AwsUtil.GetPartitionRegion(),
            });
            const response = await iam.listAccountAliases({ MaxItems: 1 }).promise();
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
            const iamService = await AwsUtil.GetIamService(accountId, targetRoleConfig.role, targetRoleConfig.viaRole);
            try {
                const response = await iamService.getAccountPasswordPolicy().promise();
                return response.PasswordPolicy;
            } catch (err) {
                if (err && err.code === 'NoSuchEntity') {
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
            const request: ListTagsForResourceRequest = {
                ResourceId: accountId,
            };
            const response = await performAndRetryIfNeeded(() => that.organizationService.listTagsForResource(request).promise());
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
    public readonly organization: Lazy<Organization>;
    public readonly roots: Lazy<AWSRoot[]>;
    private readonly organizationService: Organizations;

    constructor(organizationService: Organizations, private readonly crossAccountConfig?: ICrossAccountConfig, partitionCredentials?: CredentialsOptions) {

        this.organizationService = organizationService;
        this.policies = new Lazy(this, AwsOrganizationReader.listPolicies);
        this.organizationalUnits = new Lazy(this, AwsOrganizationReader.listOrganizationalUnits);
        this.accounts = new Lazy(this, AwsOrganizationReader.listAccounts);
        this.organization = new Lazy(this, AwsOrganizationReader.getOrganization);
        this.roots = new Lazy(this, AwsOrganizationReader.listRoots);
        if (partitionCredentials) {
            this.partitionOrgService = new Organizations({ credentials: partitionCredentials, region: AwsUtil.GetPartitionRegion() });
            this.partitionOrgSTS = new STS({ credentials: partitionCredentials, region: AwsUtil.GetPartitionRegion() });
        }
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
