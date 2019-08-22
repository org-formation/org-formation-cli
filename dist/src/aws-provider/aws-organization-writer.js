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
        const createPolicyRequest = {
            Name: resource.policyName,
            Description: resource.description,
            Type: 'SERVICE_CONTROL_POLICY',
            Content: JSON.stringify(resource.policyDocument, null, 2),
        };
        const response = await this.organizationService.createPolicy(createPolicyRequest).promise();
        return response.Policy.PolicySummary.Id;
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
        const account = this.organization.accounts.find((x) => x.Email === resource.rootEmail);
        if (account !== undefined) {
            console.log(`SKIP: account with email ${resource.rootEmail} was already part of the organization (accountId: ${account.Id}).`);
            return account.Id;
        }
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
        this.organization.accounts.push({
            Arn: `arn:aws:organizations::${this.organization.masterAccount}:account/${this.organization.organization.Id}/${accountCreationStatus.AccountId}`,
            Id: accountCreationStatus.AccountId,
            ParentId: this.organization.roots[0].Id,
            Policies: [],
            Name: resource.accountName,
            Type: 'Account',
        });
        return accountCreationStatus.AccountId;
    }
}
exports.AwsOrganizationWriter = AwsOrganizationWriter;
function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}
//# sourceMappingURL=aws-organization-writer.js.map