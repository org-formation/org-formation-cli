"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function GetPoliciesForTarget(list, targetId, targetType) {
    return list.filter((x) => x.Targets.find((y) => y.TargetId === targetId && y.Type === targetType));
}
class AwsOrganizationReader {
    static async getOrganization(that) {
        that.organizationService.listTagsForResource();
        const resp = await that.organizationService.describeOrganization().promise();
        return resp.Organization;
    }
    static async listPolicies(that) {
        const result = [];
        const req = {
            Filter: 'SERVICE_CONTROL_POLICY',
        };
        let resp;
        do {
            resp = await that.organizationService.listPolicies(req).promise();
            for (const policy of resp.Policies) {
                const describedPolicy = await that.organizationService.describePolicy({ PolicyId: policy.Id }).promise();
                const awsPolicy = Object.assign({}, describedPolicy.Policy, { Type: 'Policy', Name: policy.Name, Id: policy.Id, Targets: [] });
                result.push(awsPolicy);
                const listTargetsReq = {
                    PolicyId: policy.Id,
                };
                let listTargetsResp;
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
    static async listRoots(that) {
        const result = [];
        let resp;
        const req = {};
        do {
            resp = await that.organizationService.listRoots(req).promise();
            result.push(...resp.Roots);
            req.NextToken = resp.NextToken;
        } while (resp.NextToken);
        return result;
    }
    static async listOrganizationalUnits(that) {
        const rootsIds = [];
        const result = [];
        const policies = await that.policies.getValue();
        const roots = await that.roots.getValue();
        rootsIds.push(...roots.map((x) => x.Id));
        do {
            const req = {
                ParentId: rootsIds.pop(),
            };
            let resp;
            do {
                resp = await that.organizationService.listOrganizationalUnitsForParent(req).promise();
                req.NextToken = resp.NextToken;
                for (const ou of resp.OrganizationalUnits) {
                    const organization = Object.assign({}, ou, { Type: 'OrganizationalUnit', Name: ou.Name, Id: ou.Id, ParentId: req.ParentId, Accounts: [], Policies: GetPoliciesForTarget(policies, ou.Id, 'ORGANIZATIONAL_UNIT') });
                    result.push(organization);
                    rootsIds.push(ou.Id);
                }
            } while (resp.NextToken);
        } while (rootsIds.length > 0);
        return result;
    }
    static async listAccounts(that) {
        const result = [];
        const organizationalUnits = await that.organizationalUnits.getValue();
        const policies = await that.policies.getValue();
        const roots = await that.roots.getValue();
        const parentIds = organizationalUnits.map((x) => x.Id);
        const rootIds = roots.map((x) => x.Id);
        parentIds.push(...rootIds);
        do {
            const req = {
                ParentId: parentIds.pop(),
            };
            let resp;
            do {
                resp = await that.organizationService.listAccountsForParent(req).promise();
                req.NextToken = resp.NextToken;
                for (const acc of resp.Accounts) {
                    const account = Object.assign({}, acc, { Type: 'Account', Name: acc.Name, Id: acc.Id, ParentId: req.ParentId, Policies: GetPoliciesForTarget(policies, acc.Id, 'ORGANIZATIONAL_UNIT'), Tags: await AwsOrganizationReader.getTagsForAccount(that, acc.Id) });
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
    static async getTagsForAccount(that, accountId) {
        const request = {
            ResourceId: accountId,
        };
        const response = await that.organizationService.listTagsForResource(request).promise();
        const tags = {};
        for (const tag of response.Tags) {
            tags[tag.Key] = tag.Value;
        }
        return tags;
    }
    constructor(organizationService) {
        this.organizationService = organizationService;
        this.policies = new Lazy(this, AwsOrganizationReader.listPolicies);
        this.organizationalUnits = new Lazy(this, AwsOrganizationReader.listOrganizationalUnits);
        this.accounts = new Lazy(this, AwsOrganizationReader.listAccounts);
        this.organization = new Lazy(this, AwsOrganizationReader.getOrganization);
        this.roots = new Lazy(this, AwsOrganizationReader.listRoots);
    }
}
exports.AwsOrganizationReader = AwsOrganizationReader;
class Lazy {
    constructor(that, obtainValueFn) {
        this.that = that;
        this.obtainValueFn = obtainValueFn;
    }
    async getValue(since) {
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
//# sourceMappingURL=aws-organization-reader.js.map