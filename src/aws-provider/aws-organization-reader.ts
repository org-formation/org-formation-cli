import { IAM, Organizations, STS } from 'aws-sdk/clients/all';
import { Account, ListAccountsForParentRequest, ListAccountsForParentResponse, ListAccountsResponse, ListOrganizationalUnitsForParentRequest, ListOrganizationalUnitsForParentResponse, ListPoliciesRequest, ListPoliciesResponse, ListRootsRequest, ListRootsResponse, ListTagsForResourceRequest, ListTargetsForPolicyRequest, ListTargetsForPolicyResponse, Organization, OrganizationalUnit, Policy, PolicyTargetSummary, Root, TargetType } from 'aws-sdk/clients/organizations';
import { AwsUtil } from '../aws-util';

export type AWSObjectType = 'Account' | 'OrganizationalUnit' | 'Policy' | string;

interface IAWSTags {
    [key: string]: string;
}
interface IAWSAccountWithTags {
    Tags?: IAWSTags;
}
interface IAWSAccountWithIAMAttributes {
    Alias?: string;
    PasswordPolicy?: IAM.PasswordPolicy;
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

interface IObjectWithPolicies {
    Policies: AWSPolicy[];
}

interface IPolicyTargets {
    Targets: PolicyTargetSummary[];
}

export type AWSPolicy = Policy & IPolicyTargets & IAWSObject;
export type AWSAccount = Account & IAWSAccountWithTags & IAWSAccountWithIAMAttributes & IObjectWithParentId & IObjectWithPolicies & IAWSObject;
export type AWSOrganizationalUnit = OrganizationalUnit & IObjectWithParentId & IObjectWithPolicies & IObjectWithAccounts & IAWSObject;
export type AWSRoot = Root & IObjectWithPolicies;

function GetPoliciesForTarget(list: AWSPolicy[], targetId: string, targetType: TargetType): AWSPolicy[] {
    return list.filter((x) => x.Targets.find((y) => y.TargetId === targetId && y.Type === targetType));
}

export class AwsOrganizationReader {

    private static async getOrganization(that: AwsOrganizationReader): Promise<Organization> {
        that.organizationService.listTagsForResource();
        const resp = await that.organizationService.describeOrganization().promise();
        return resp.Organization;
    }

    private static async listPolicies(that: AwsOrganizationReader): Promise<AWSPolicy[]> {
        const result: AWSPolicy[] = [];
        const req: ListPoliciesRequest = {
            Filter: 'SERVICE_CONTROL_POLICY',
        };
        let resp: ListPoliciesResponse;
        do {
            resp = await that.organizationService.listPolicies(req).promise();
            for (const policy of resp.Policies) {

                const describedPolicy = await that.organizationService.describePolicy({ PolicyId: policy.Id }).promise();

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
                    listTargetsResp = await that.organizationService.listTargetsForPolicy(listTargetsReq).promise();
                    awsPolicy.Targets.push(...listTargetsResp.Targets);
                    listTargetsReq.NextToken = listTargetsResp.NextToken;
                } while (listTargetsReq.NextToken);
            }
            req.NextToken = resp.NextToken;
        } while (resp.NextToken);

        return result;
    }

    private static async listRoots(that: AwsOrganizationReader): Promise<AWSRoot[]> {
        const result: AWSRoot[] = [];
        const policies = await that.policies.getValue();
        let resp: ListRootsResponse;
        const req: ListRootsRequest = {};
        do {
            resp = await that.organizationService.listRoots(req).promise();
            req.NextToken = resp.NextToken;
            for (const root of resp.Roots) {
                const item = {
                    ...root,
                    Policies: GetPoliciesForTarget(policies, root.Id, 'ROOT'),
                };
                result.push(item);
            }
        } while (resp.NextToken);

        return result;
    }

    private static async listOrganizationalUnits(that: AwsOrganizationReader): Promise<AWSOrganizationalUnit[]> {
        const rootsIds: string[] = [];
        const result: AWSOrganizationalUnit[] = [];

        const policies = await that.policies.getValue();
        const roots = await that.roots.getValue();
        rootsIds.push(...roots.map((x) => x.Id!));

        do {
            const req: ListOrganizationalUnitsForParentRequest = {
                ParentId: rootsIds.pop(),
            };
            let resp: ListOrganizationalUnitsForParentResponse;
            do {
                resp = await that.organizationService.listOrganizationalUnitsForParent(req).promise();
                req.NextToken = resp.NextToken;
                if (!resp.OrganizationalUnits) { continue; }

                for (const ou of resp.OrganizationalUnits) {
                    const organization = {
                        ...ou,
                        Type: 'OrganizationalUnit',
                        Name: ou.Name,
                        Id: ou.Id!,
                        ParentId: req.ParentId,
                        Accounts: [] as AWSAccount[],
                        Policies: GetPoliciesForTarget(policies, ou.Id, 'ORGANIZATIONAL_UNIT'),
                    };

                    result.push(organization);
                    rootsIds.push(organization.Id);
                }

            } while (resp.NextToken);

        } while (rootsIds.length > 0);

        return result;
    }

    private static async listAccounts(that: AwsOrganizationReader): Promise<AWSAccount[]> {
        const result: AWSAccount[] = [];
        const organizationalUnits = await that.organizationalUnits.getValue();
        const policies = await that.policies.getValue();
        const roots = await that.roots.getValue();
        const parentIds = organizationalUnits.map((x) => x.Id);
        const rootIds = roots.map((x) => x.Id);
        parentIds.push(...rootIds);

        do {
            const req: ListAccountsForParentRequest = {
                ParentId: parentIds.pop(),
            };
            let resp: ListAccountsForParentResponse;
            do {
                resp = await that.organizationService.listAccountsForParent(req).promise();
                req.NextToken = resp.NextToken;

                for (const acc of resp.Accounts) {
                    if (acc.Status === 'SUSPENDED') {
                        continue;
                    }

                    const [tags, alias, passwordPolicy] = await Promise.all([
                        AwsOrganizationReader.getTagsForAccount(that, acc.Id),
                        AwsOrganizationReader.getIamAliasForAccount(that, acc.Id),
                        AwsOrganizationReader.getIamPasswordPolicyForAccount(that, acc.Id),
                    ]);

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
                    };

                    const parentOU = organizationalUnits.find((x) => x.Id === req.ParentId);
                    if (parentOU) {
                        parentOU.Accounts.push(account);
                    }
                    result.push(account);
                }

            } while (resp.NextToken);

        } while (parentIds.length > 0);

        return result;
    }

    private static async getIamAliasForAccount(that: AwsOrganizationReader, accountId: string): Promise<string> {
        const org = await that.organization.getValue();
        const iamService = await AwsUtil.GetIamService(org, accountId);
        const response = await iamService.listAccountAliases({ MaxItems: 1 }).promise();
        if (response && response.AccountAliases && response.AccountAliases.length >= 1) {
            return response.AccountAliases[0];
        } else {
            return undefined;
        }
    }

    private static async getIamPasswordPolicyForAccount(that: AwsOrganizationReader, accountId: string): Promise<IAM.PasswordPolicy> {
        const org = await that.organization.getValue();
        const iamService = await AwsUtil.GetIamService(org, accountId);
        try {
            const response = await iamService.getAccountPasswordPolicy().promise();
            return response.PasswordPolicy;
        } catch (err) {
            if (err && err.code === 'NoSuchEntity') {
                return undefined;
            }
            throw err;
        }
    }

    private static async getTagsForAccount(that: AwsOrganizationReader, accountId: string): Promise<IAWSTags> {
        const request: ListTagsForResourceRequest = {
            ResourceId: accountId,
        };
        const response = await that.organizationService.listTagsForResource(request).promise();
        const tags: IAWSTags = {};
        for (const tag of response.Tags) {
            tags[tag.Key] = tag.Value;
        }
        return tags;
    }

    public readonly policies: Lazy<AWSPolicy[]>;
    public readonly accounts: Lazy<AWSAccount[]>;
    public readonly organizationalUnits: Lazy<AWSOrganizationalUnit[]>;
    public readonly organization: Lazy<Organization>;
    public readonly roots: Lazy<AWSRoot[]>;
    private readonly organizationService: Organizations;

    constructor(organizationService: Organizations) {
        this.organizationService = organizationService;
        this.policies = new Lazy(this, AwsOrganizationReader.listPolicies);
        this.organizationalUnits = new Lazy(this, AwsOrganizationReader.listOrganizationalUnits);
        this.accounts = new Lazy(this, AwsOrganizationReader.listAccounts);
        this.organization = new Lazy(this, AwsOrganizationReader.getOrganization);
        this.roots = new Lazy(this, AwsOrganizationReader.listRoots);
    }
}

class Lazy<T> {
    private cachedValue: T | undefined;
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
        this.cachedValue = await this.obtainValueFn(this.that);
        this.valueTimestamp = new Date();
        return this.cachedValue;
    }
}
