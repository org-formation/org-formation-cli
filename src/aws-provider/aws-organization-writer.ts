import { Organizations } from 'aws-sdk/clients/all';
import { AttachPolicyRequest, CreateAccountRequest, CreateOrganizationalUnitRequest, CreatePolicyRequest, DeleteOrganizationalUnitRequest, DeletePolicyRequest, DescribeCreateAccountStatusRequest, DetachPolicyRequest, EnablePolicyTypeRequest, MoveAccountRequest, UpdateOrganizationalUnitRequest, UpdatePolicyRequest } from 'aws-sdk/clients/organizations';
import { AccountResource } from '../parser/model/account-resource';
import { OrganizationalUnitResource } from '../parser/model/organizational-unit-resource';
import { ServiceControlPolicyResource } from '../parser/model/service-control-policy-resource';
import { AwsOrganization } from './aws-organization';

export class AwsOrganizationWriter {
    private organization: AwsOrganization;
    private organizationService: Organizations;

    constructor(organizationService: Organizations, organization: AwsOrganization) {
        this.organizationService = organizationService;
        this.organization = organization;
    }

    public async ensureSCPEnabled() {
        const enablePolicyTypeReq: EnablePolicyTypeRequest = {
            RootId: this.organization.roots[0].Id,
            PolicyType: 'SERVICE_CONTROL_POLICY',
        };
        try {
            const response = await this.organizationService.enablePolicyType(enablePolicyTypeReq).promise();
            console.log(response);
        } catch (err) {
            if (err && err.code === 'PolicyTypeAlreadyEnabledException') {
                // do nothing
            } else {
                throw err;
            }
        }
    }

    public async createPolicy(resource: ServiceControlPolicyResource): Promise<string> {
        const createPolicyRequest: CreatePolicyRequest = {
            Name: resource.policyName,
            Description: resource.description,
            Type: 'SERVICE_CONTROL_POLICY',
            Content: JSON.stringify(resource.policyDocument, null, 2),
        };
        const response = await this.organizationService.createPolicy(createPolicyRequest).promise();
        return response.Policy.PolicySummary.Id;
    }

    public async attachPolicy(targetPhysicalId: string, policyPhysicalId: string) {
        const attachPolicyRequest: AttachPolicyRequest = {
            PolicyId: policyPhysicalId,
            TargetId: targetPhysicalId,
        };

        try {
            await this.ensureSCPEnabled();
            await this.organizationService.attachPolicy(attachPolicyRequest).promise();
        } catch (err) {
            if (err && err.code === 'PolicyTypeNotEnabledException') {
                await this.ensureSCPEnabled();
                await this.organizationService.attachPolicy(attachPolicyRequest).promise();
            } else {
                throw err;
            }
        }

    }

    public async detachPolicy(targetPhysicalId: string, policyPhysicalId: string) {
        const detachPolicyRequest: DetachPolicyRequest = {
            PolicyId: policyPhysicalId,
            TargetId: targetPhysicalId,
        };

        await this.organizationService.detachPolicy(detachPolicyRequest).promise();
    }

    public async updatePolicy(resource: ServiceControlPolicyResource, physicalId: string) {
        const updatePolicyRequest: UpdatePolicyRequest = {
            PolicyId: physicalId,
            Name: resource.policyName,
            Description: resource.description,
            Content: JSON.stringify(resource.policyDocument, null, 2),
        };
        await this.organizationService.updatePolicy(updatePolicyRequest).promise();
    }

    public async deletePolicy(physicalId: string) {
        const deletePolicyRequest: DeletePolicyRequest = {
            PolicyId: physicalId,
        };
        await this.organizationService.deletePolicy(deletePolicyRequest).promise();
    }

    public async attachAccount(parentPhysicalId: string, accountPhysicalId: string) {
        const account = this.organization.accounts.find((x) => x.Id === accountPhysicalId);
        if (account.ParentId === parentPhysicalId) {
            console.log(`SKIP: account ${accountPhysicalId} already has parent ${parentPhysicalId}`);
            return;
        }
        const moveAccountRequest: MoveAccountRequest = {
            SourceParentId: account.ParentId,
            DestinationParentId: parentPhysicalId,
            AccountId: accountPhysicalId,
        };

        await this.organizationService.moveAccount(moveAccountRequest).promise();

        account.ParentId = parentPhysicalId;

    }

    public async createOrganizationalUnit(resource: OrganizationalUnitResource): Promise<string> {
        const roots = this.organization.roots;

        const createOrganizationalUnitRequest: CreateOrganizationalUnitRequest = {
            Name: resource.organizationalUnitName,
            ParentId: roots[0].Id,
        };
        const response = await this.organizationService.createOrganizationalUnit(createOrganizationalUnitRequest).promise();
        return response.OrganizationalUnit.Id;
    }

    public async updateOrganizationalUnit(resource: OrganizationalUnitResource, physicalId: string) {
        const updateOrganizationalUnitRequest: UpdateOrganizationalUnitRequest = {
            OrganizationalUnitId: physicalId,
            Name: resource.organizationalUnitName,
        };
        await this.organizationService.updateOrganizationalUnit(updateOrganizationalUnitRequest).promise();
    }

    public async deleteOrganizationalUnit(physicalId: string) {
        const existingOU = this.organization.organizationalUnits.find((x) => x.Id === physicalId);
        if (existingOU === undefined) {
            console.log(`SKIP: organizational unit ${physicalId} not found.`);
            return;
        }
        const root = this.organization.roots[0];
        for (const account of existingOU.Accounts) {
            await this.attachAccount(root.Id, account.Id);
        }

        const deleteOrganizationalUnitRequest: DeleteOrganizationalUnitRequest = {
            OrganizationalUnitId: physicalId,
        };
        await this.organizationService.deleteOrganizationalUnit(deleteOrganizationalUnitRequest).promise();
    }

    public async createAccount(resource: AccountResource): Promise<string> {

        const account = this.organization.accounts.find((x) => x.Email === resource.rootEmail);
        if (account !== undefined) {
            console.log(`SKIP: account with email ${resource.rootEmail} was already part of the organization (accountId: ${account.Id}).`);
            return account.Id;
        }

        const createAccountReq: CreateAccountRequest = {
            Email: resource.rootEmail,
            AccountName: resource.accountName,
        };
        const createAccountResponse = await this.organizationService.createAccount(createAccountReq).promise();
        let accountCreationStatus = createAccountResponse.CreateAccountStatus;
        while (accountCreationStatus.State !== 'SUCCEEDED') {
            if (accountCreationStatus.State === 'FAILED') {
                throw new Error('creating account failed, reason: ' + accountCreationStatus.FailureReason);
            }
            const describeAccountStatusReq: DescribeCreateAccountStatusRequest = {
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

function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}
