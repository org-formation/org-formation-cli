import { Organizations } from 'aws-sdk/clients/all';
import { Account, ListAccountsForParentRequest, ListAccountsForParentResponse, ListAccountsResponse, ListOrganizationalUnitsForParentRequest, ListOrganizationalUnitsForParentResponse, ListPoliciesRequest, ListPoliciesResponse, ListRootsRequest, ListRootsResponse, ListTargetsForPolicyRequest, ListTargetsForPolicyResponse, Organization, OrganizationalUnit, Policy, PolicyTargetSummary, Root, TargetType } from 'aws-sdk/clients/organizations';

export type AWSObjectType = 'Account' | 'OrganizationalUnit' | 'Policy' | string;
interface ObjectWithParentId {
    ParentId: string;
}

export interface AWSObject {
    Type: AWSObjectType;
    Id: string;
    Name: string;
}

interface ObjectWithAccounts {
    Accounts: AWSAccount[];
}

interface ObjectWithPolicies {
    Policies: AWSPolicy[];
}

interface PolicyTargets {
    Targets: PolicyTargetSummary[];
}

export type AWSPolicy = Policy & PolicyTargets & AWSObject;
export type AWSAccount = Account & ObjectWithParentId & ObjectWithPolicies & AWSObject;
export type AWSOrganizationalUnit = OrganizationalUnit & ObjectWithParentId & ObjectWithPolicies & ObjectWithAccounts & AWSObject;
export type AWSRoot = Root & ObjectWithAccounts;

function GetPoliciesForTarget(list: AWSPolicy[], targetId: string, targetType: TargetType): AWSPolicy[] {
    return list.filter((x) => x.Targets.find((y) => y.TargetId === targetId && y.Type === targetType));
}

export class AwsOrganizationReader {

    private static async getOrganization(that: AwsOrganizationReader): Promise<Organization> {

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

                const describedPolicy = await that.organizationService.describePolicy({PolicyId: policy.Id}).promise();
                const awsPolicy = {
                        ...describedPolicy.Policy,
                        Type: 'Policy',
                        Name: policy.Name,
                        Id: policy.Id,
                        Targets: []};

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

    private static async listRoots(that: AwsOrganizationReader): Promise<Root[]> {
        const result: Root[] = [];
        let resp: ListRootsResponse;
        const req: ListRootsRequest = {};
        do {
            resp = await that.organizationService.listRoots(req).promise();
            result.push(...resp.Roots);
            req.NextToken = resp.NextToken;
        } while (resp.NextToken);

        return result;
    }

    private static async listOrganizationalUnits(that: AwsOrganizationReader): Promise<AWSOrganizationalUnit[]> {
        const rootsIds: string[] = [];
        const result: AWSOrganizationalUnit[] = [];

        const policies = await that.policies.getValue();
        const roots = await that.roots.getValue();
        rootsIds.push(...roots.map((x) => x.Id));

        do {

            const req: ListOrganizationalUnitsForParentRequest = {
                ParentId: rootsIds.pop(),
            };
            let resp: ListOrganizationalUnitsForParentResponse;
            do {
                resp = await that.organizationService.listOrganizationalUnitsForParent(req).promise();
                req.NextToken = resp.NextToken;

                for (const ou of resp.OrganizationalUnits) {
                    const organization = {
                            ...ou,
                            Type: 'OrganizationalUnit',
                            Name: ou.Name,
                            Id: ou.Id,
                            ParentId: req.ParentId,
                            Accounts: [],
                            Policies: GetPoliciesForTarget(policies, ou.Id, 'ORGANIZATIONAL_UNIT')};

                    result.push(organization);
                    rootsIds.push(ou.Id);
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
                    const account = {
                        ...acc,
                        Type: 'Account',
                        Name: acc.Name,
                        Id: acc.Id,
                        ParentId: req.ParentId,
                        Policies: GetPoliciesForTarget(policies, acc.Id, 'ORGANIZATIONAL_UNIT'),
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
    public readonly policies: Lazy<AWSPolicy[]>;
    public readonly accounts: Lazy<AWSAccount[]>;
    public readonly organizationalUnits: Lazy<AWSOrganizationalUnit[]>;
    public readonly organization: Lazy<Organization>;
    public readonly roots: Lazy<Root[]>;
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
    private cachedValue: T;
    private valueTimestamp: Date;
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
