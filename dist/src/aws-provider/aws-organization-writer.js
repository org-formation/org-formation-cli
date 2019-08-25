"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class AwsOrganizationWriter {
    constructor(organizationService, organization) {
        this.organizationService = organizationService;
        this.organization = organization;
    }
    async ensureSCPEnabled() {
        const enablePolicyTypeReq = {
            RootId: this.organization.roots[0].Id,
            PolicyType: 'SERVICE_CONTROL_POLICY',
        };
        try {
            const response = await this.organizationService.enablePolicyType(enablePolicyTypeReq).promise();
            console.log(response);
        }
        catch (err) {
            if (err && err.code === 'PolicyTypeAlreadyEnabledException') {
                // do nothing
            }
            else {
                throw err;
            }
        }
    }
    async createPolicy(resource) {
        try {
            const createPolicyRequest = {
                Name: resource.policyName,
                Description: resource.description,
                Type: 'SERVICE_CONTROL_POLICY',
                Content: JSON.stringify(resource.policyDocument, null, 2),
            };
            const response = await this.organizationService.createPolicy(createPolicyRequest).promise();
            return response.Policy.PolicySummary.Id;
        }
        catch (err) {
            if (err.code === 'DuplicatePolicyException') {
                const existingPolicy = this.organization.policies.find((x) => x.Name === resource.policyName);
                await this.updatePolicy(resource, existingPolicy.Id);
                return existingPolicy.Id;
            }
            throw err;
        }
    }
    async attachPolicy(targetPhysicalId, policyPhysicalId) {
        const attachPolicyRequest = {
            PolicyId: policyPhysicalId,
            TargetId: targetPhysicalId,
        };
        try {
            await this.ensureSCPEnabled();
            await this.organizationService.attachPolicy(attachPolicyRequest).promise();
        }
        catch (err) {
            if (err && err.code === 'PolicyTypeNotEnabledException') {
                await this.ensureSCPEnabled();
                await this.organizationService.attachPolicy(attachPolicyRequest).promise();
            }
            else {
                throw err;
            }
        }
    }
    async detachPolicy(targetPhysicalId, policyPhysicalId) {
        const detachPolicyRequest = {
            PolicyId: policyPhysicalId,
            TargetId: targetPhysicalId,
        };
        await this.organizationService.detachPolicy(detachPolicyRequest).promise();
    }
    async updatePolicy(resource, physicalId) {
        const updatePolicyRequest = {
            PolicyId: physicalId,
            Name: resource.policyName,
            Description: resource.description,
            Content: JSON.stringify(resource.policyDocument, null, 2),
        };
        await this.organizationService.updatePolicy(updatePolicyRequest).promise();
    }
    async deletePolicy(physicalId) {
        const deletePolicyRequest = {
            PolicyId: physicalId,
        };
        await this.organizationService.deletePolicy(deletePolicyRequest).promise();
    }
    async attachAccount(parentPhysicalId, accountPhysicalId) {
        const account = this.organization.accounts.find((x) => x.Id === accountPhysicalId);
        if (account.ParentId === parentPhysicalId) {
            console.log(`SKIP: account ${accountPhysicalId} already has parent ${parentPhysicalId}`);
            return;
        }
        const moveAccountRequest = {
            SourceParentId: account.ParentId,
            DestinationParentId: parentPhysicalId,
            AccountId: accountPhysicalId,
        };
        await this.organizationService.moveAccount(moveAccountRequest).promise();
        account.ParentId = parentPhysicalId;
    }
    async createOrganizationalUnit(resource) {
        const roots = this.organization.roots;
        const createOrganizationalUnitRequest = {
            Name: resource.organizationalUnitName,
            ParentId: roots[0].Id,
        };
        // add catch and update instead of create
        const response = await this.organizationService.createOrganizationalUnit(createOrganizationalUnitRequest).promise();
        return response.OrganizationalUnit.Id;
    }
    async updateOrganizationalUnit(resource, physicalId) {
        const updateOrganizationalUnitRequest = {
            OrganizationalUnitId: physicalId,
            Name: resource.organizationalUnitName,
        };
        await this.organizationService.updateOrganizationalUnit(updateOrganizationalUnitRequest).promise();
    }
    async deleteOrganizationalUnit(physicalId) {
        const existingOU = this.organization.organizationalUnits.find((x) => x.Id === physicalId);
        if (existingOU === undefined) {
            console.log(`SKIP: organizational unit ${physicalId} not found.`);
            return;
        }
        const root = this.organization.roots[0];
        for (const account of existingOU.Accounts) {
            await this.attachAccount(root.Id, account.Id);
        }
        const deleteOrganizationalUnitRequest = {
            OrganizationalUnitId: physicalId,
        };
        await this.organizationService.deleteOrganizationalUnit(deleteOrganizationalUnitRequest).promise();
    }
    async createAccount(resource) {
        let accountId = resource.accountId;
        // todo and check on accountId
        const account = this.organization.accounts.find((x) => x.Id === resource.accountId);
        if (account !== undefined) {
            await this.updateAccount(resource, account.Id);
            return account.Id;
        }
        accountId = await this._createAccount(resource);
        await this.updateAccount(resource, accountId);
        this.organization.accounts.push({
            Arn: `arn:aws:organizations::${this.organization.masterAccount}:account/${this.organization.organization.Id}/${accountId}`,
            Id: accountId,
            ParentId: this.organization.roots[0].Id,
            Policies: [],
            Name: resource.accountName,
            Type: 'Account',
            Tags: resource.tags,
        });
        return accountId;
    }
    async updateAccount(resource, accountId) {
        const account = this.organization.accounts.find((x) => x.Id === resource.accountId);
        const tagsOnResource = Object.entries(resource.tags);
        const keysOnResource = tagsOnResource.map((x) => x[0]);
        const tagsOnAccount = Object.entries(account.Tags);
        const tagsToRemove = tagsOnAccount.map((x) => x[0]).filter((x) => keysOnResource.indexOf(x) === -1);
        const tagsToUpdate = keysOnResource.filter((x) => resource.tags[x] !== account.Tags[x]);
        if (tagsToRemove.length > 0) {
            const request = {
                ResourceId: accountId,
                TagKeys: tagsToRemove,
            };
            await this.organizationService.untagResource(request).promise();
        }
        if (tagsToUpdate.length > 0) {
            const tags = tagsOnResource.filter((x) => tagsToUpdate.indexOf(x[0]) >= 0).map((x) => ({ Key: x[0], Value: x[1] }));
            const request = {
                ResourceId: accountId,
                Tags: tags,
            };
            await this.organizationService.tagResource(request).promise();
        }
    }
    async _createAccount(resource) {
        const createAccountReq = {
            Email: resource.rootEmail,
            AccountName: resource.accountName,
        };
        const createAccountResponse = await this.organizationService.createAccount(createAccountReq).promise();
        let accountCreationStatus = createAccountResponse.CreateAccountStatus;
        while (accountCreationStatus.State !== 'SUCCEEDED') {
            if (accountCreationStatus.State === 'FAILED') {
                throw new Error('creating account failed, reason: ' + accountCreationStatus.FailureReason);
            }
            const describeAccountStatusReq = {
                CreateAccountRequestId: createAccountResponse.CreateAccountStatus.Id,
            };
            await sleep(1000);
            const response = await this.organizationService.describeCreateAccountStatus(describeAccountStatusReq).promise();
            accountCreationStatus = response.CreateAccountStatus;
        }
        return accountCreationStatus.AccountId;
    }
}
exports.AwsOrganizationWriter = AwsOrganizationWriter;
function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}
//# sourceMappingURL=aws-organization-writer.js.map