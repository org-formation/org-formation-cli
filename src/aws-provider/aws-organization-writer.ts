import { IAM, Organizations } from 'aws-sdk/clients/all';
import { AttachPolicyRequest, CreateAccountRequest, CreateOrganizationalUnitRequest, CreatePolicyRequest, DeleteOrganizationalUnitRequest, DeletePolicyRequest, DescribeCreateAccountStatusRequest, DetachPolicyRequest, EnablePolicyTypeRequest, MoveAccountRequest, Tag, TagResourceRequest, UntagResourceRequest, UpdateOrganizationalUnitRequest, UpdatePolicyRequest } from 'aws-sdk/clients/organizations';
import { AwsUtil, passwordPolicEquals } from '../aws-util';
import { ConsoleUtil } from '../console-util';
import { OrgFormationError } from '../org-formation-error';
import { AccountResource } from '../parser/model/account-resource';
import { OrganizationRootResource } from '../parser/model/organization-root-resource';
import { OrganizationalUnitResource } from '../parser/model/organizational-unit-resource';
import { PasswordPolicyResource } from '../parser/model/password-policy-resource';
import { Reference } from '../parser/model/resource';
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
        try {
            const createPolicyRequest: CreatePolicyRequest = {
                Name: resource.policyName,
                Description: resource.description,
                Type: 'SERVICE_CONTROL_POLICY',
                Content: JSON.stringify(resource.policyDocument, null, 2),
            };
            const response = await this.organizationService.createPolicy(createPolicyRequest).promise();
            return response.Policy.PolicySummary.Id;
        } catch (err) {
            if (err.code === 'DuplicatePolicyException') {
                const existingPolicy = this.organization.policies.find((x) => x.Name === resource.policyName);
                await this.updatePolicy(resource, existingPolicy.Id);
                return existingPolicy.Id;
            }

            throw err;
        }
    }

    public async attachPolicy(targetPhysicalId: string, policyPhysicalId: string) {

        // TODO: add retry on ConcurrentModificationException

        const attachPolicyRequest: AttachPolicyRequest = {
            PolicyId: policyPhysicalId,
            TargetId: targetPhysicalId,
        };
        try {
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
        } catch (err) {
            if (err && err.code !== 'DuplicatePolicyAttachmentException') {
                throw err;
            }
        }
    }

    public async detachPolicy(targetPhysicalId: string, policyPhysicalId: string) {

        // TODO: add retry on

        const detachPolicyRequest: DetachPolicyRequest = {
            PolicyId: policyPhysicalId,
            TargetId: targetPhysicalId,
        };
        try {
            await this.organizationService.detachPolicy(detachPolicyRequest).promise();
        } catch (err) {
            if (err && err.code !== 'PolicyNotAttachedException' && err.code !== 'PolicyNotFoundException') {
                // 'ConcurrentModificationException' ??
                throw err;
            }
        }
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
        try {
            await this.organizationService.deletePolicy(deletePolicyRequest).promise();
        } catch (err) {
            if (err && err.code !== 'PolicyNotFoundException' && err.code !== 'PolicyInUseException') {
                // 'ConcurrentModificationException' ??
                throw err;
            }
        }
    }

    public async detachAccount(targetId: string, accountId: string) {
        await this.attachAccount(this.organization.roots[0].Id, accountId);
    }

    public async attachAccount(parentPhysicalId: string, accountPhysicalId: string) {
        const account = this.organization.accounts.find((x) => x.Id === accountPhysicalId);
        if (account.ParentId === parentPhysicalId) {
            ConsoleUtil.LogDebug(`account ${accountPhysicalId} already has parent ${parentPhysicalId}`);
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

    public async ensureRoot(): Promise<string> {
        const roots = this.organization.roots;
        return roots[0].Id;
    }

    public async createOrganizationalUnit(resource: OrganizationalUnitResource): Promise<string> {
        const organizationalUnit = this.organization.organizationalUnits.find((x) => x.Name === resource.organizationalUnitName);
        if (organizationalUnit) {
            ConsoleUtil.LogDebug(`ou with name ${resource.organizationalUnitName} already exists`);
            return organizationalUnit.Id;
        }
        const roots = this.organization.roots;
        const organizationalUnitId = await this._createOrganizationalUnit(resource, roots[0].Id);

        return organizationalUnitId;
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
            ConsoleUtil.LogDebug(`organizational unit ${physicalId} not found.`);
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

        let accountId = resource.accountId;

        // todo and check on accountId
        const account = [...this.organization.accounts, this.organization.masterAccount].find((x) => x.Id === resource.accountId || x.Email === resource.rootEmail);
        if (account !== undefined) {
            await this.updateAccount(resource, account.Id);
            ConsoleUtil.LogDebug(`account with email ${resource.rootEmail} was already part of the organization (accountId: ${account.Id}).`);
            return account.Id;
        }

        accountId = await this._createAccount(resource);

        await this.updateAccount(resource, accountId);
        return accountId;
    }

    public async updateAccount(resource: AccountResource, accountId: string) {
        const account = [...this.organization.accounts, this.organization.masterAccount].find((x) => x.Id === accountId);

        if (account.Name !== resource.accountName) {
            ConsoleUtil.LogWarning(`account name for ${accountId} (logicalId: ${resource.logicalId}) cannot be changed from '${account.Name}' to '${resource.accountName}'. \nInstead: login with root on the specified account to change its name`);
        }

        if (account.Alias !== resource.alias) {
            const iam = await AwsUtil.GetIamService(this.organization.organization, accountId);
            if (account.Alias) {
                try {
                    await iam.deleteAccountAlias({AccountAlias: account.Alias}).promise();
                } catch (err) {
                    if (err && err.code !== 'NoSuchEntity') {
                        throw err;
                    }
                }
            }
            if (resource.alias) {
                await iam.createAccountAlias({AccountAlias: resource.alias}).promise();
            }

        }

        if (!passwordPolicEquals(account.PasswordPolicy, resource.passwordPolicy)) {
            const iam = await AwsUtil.GetIamService(this.organization.organization, accountId);
            if (account.PasswordPolicy) {
                try {
                    await iam.deleteAccountPasswordPolicy().promise();
                } catch (err) {
                    if (err && err.code !== 'NoSuchEntity') {
                        throw err;
                    }
                }
            }
            if (resource.passwordPolicy && resource.passwordPolicy.TemplateResource) {
                const passwordPolicy = resource.passwordPolicy.TemplateResource;
                await iam.updateAccountPasswordPolicy({
                    MinimumPasswordLength: passwordPolicy.minimumPasswordLength,
                    RequireSymbols: passwordPolicy.requireSymbols,
                    RequireNumbers: passwordPolicy.requireNumbers,
                    RequireUppercaseCharacters: passwordPolicy.requireUppercaseCharacters,
                    RequireLowercaseCharacters: passwordPolicy.requireLowercaseCharacters,
                    MaxPasswordAge: passwordPolicy.maxPasswordAge,
                    PasswordReusePrevention: passwordPolicy.passwordReusePrevention,
                    AllowUsersToChangePassword: passwordPolicy.allowUsersToChangePassword,
                }).promise();
            }
        }

        const tagsOnResource = Object.entries(resource.tags || {});
        const keysOnResource = tagsOnResource.map((x) => x[0]);
        const tagsOnAccount = Object.entries(account.Tags);
        const tagsToRemove = tagsOnAccount.map((x) => x[0]).filter((x) => keysOnResource.indexOf(x) === -1);
        const tagsToUpdate = keysOnResource.filter((x) => resource.tags[x] !== account.Tags[x]);

        if (tagsToRemove.length > 0) {
            const request: UntagResourceRequest = {
                ResourceId: accountId,
                TagKeys: tagsToRemove,
            };
            await this.organizationService.untagResource(request).promise();
        }

        if (tagsToUpdate.length > 0) {
            const tags: Tag[] = tagsOnResource.filter((x) => tagsToUpdate.indexOf(x[0]) >= 0).map((x) => ({Key: x[0], Value : (x[1] || '').toString() }));

            const request: TagResourceRequest = {
                ResourceId: accountId,
                Tags: tags,
            };
            await this.organizationService.tagResource(request).promise();
        }

        account.Tags = resource.tags;
    }

    private async _createOrganizationalUnit(resource: OrganizationalUnitResource, parentId: string): Promise<string> {
        const createOrganizationalUnitRequest: CreateOrganizationalUnitRequest = {
            Name: resource.organizationalUnitName,
            ParentId: parentId,
        };

        const response = await this.organizationService.createOrganizationalUnit(createOrganizationalUnitRequest).promise();

        this.organization.organizationalUnits.push({
            Arn: `arn:aws:organizations::${this.organization.masterAccount.Id}:ou/${this.organization.organization.Id}/${response.OrganizationalUnit.Id}`,
            Id: response.OrganizationalUnit.Id,
            ParentId: this.organization.roots[0].Id,
            Policies: [],
            Name: resource.organizationalUnitName,
            Type: 'OrganizationalUnit',
            Accounts: [],
        });

        return response.OrganizationalUnit.Id;
    }

    private async _createAccount(resource: AccountResource): Promise<string> {
        const createAccountReq: CreateAccountRequest = {
            Email: resource.rootEmail,
            AccountName: resource.accountName,
        };

        const createAccountResponse = await this.organizationService.createAccount(createAccountReq).promise();
        let accountCreationStatus = createAccountResponse.CreateAccountStatus;
        while (accountCreationStatus.State !== 'SUCCEEDED') {
            if (accountCreationStatus.State === 'FAILED') {
                throw new OrgFormationError('creating account failed, reason: ' + accountCreationStatus.FailureReason);
            }
            const describeAccountStatusReq: DescribeCreateAccountStatusRequest = {
                CreateAccountRequestId: createAccountResponse.CreateAccountStatus.Id,
            };
            await sleep(1000);
            const response = await this.organizationService.describeCreateAccountStatus(describeAccountStatusReq).promise();
            accountCreationStatus = response.CreateAccountStatus;
        }

        this.organization.accounts.push({
            Arn: `arn:aws:organizations::${this.organization.masterAccount.Id}:account/${this.organization.organization.Id}/${accountCreationStatus.AccountId}`,
            Id: accountCreationStatus.AccountId,
            ParentId: this.organization.roots[0].Id,
            Policies: [],
            Name: resource.accountName,
            Email: resource.rootEmail,
            Type: 'Account',
            Tags: {},
        });

        return accountCreationStatus.AccountId;
    }
}

function sleep(time: number) {
    return new Promise((resolve) => setTimeout(resolve, time));
}
