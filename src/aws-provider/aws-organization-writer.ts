import * as Organizations from '@aws-sdk/client-organizations';
import * as IAM from '@aws-sdk/client-iam';
import { CreateCaseCommand } from '@aws-sdk/client-support';
import { STSServiceException } from '@aws-sdk/client-sts';
import { AwsUtil, passwordPolicyEquals } from '../util/aws-util';
import { ConsoleUtil } from '../util/console-util';
import { OrgFormationError } from '../org-formation-error';
import { AwsEvents } from './aws-events';
import { AwsOrganization } from './aws-organization';
import { AWSOrganizationalUnit, AWSPolicy, AWSAccount } from './aws-organization-reader';
import { GetOrganizationAccessRoleInTargetAccount, ICrossAccountConfig } from './aws-account-access';
import { performAndRetryIfNeeded, sleep } from './util';
import {
    AccountResource,
    OrganizationalUnitResource,
    ServiceControlPolicyResource,
} from '~parser/model';

export interface PartitionCreateResponse {
    PhysicalId: string;
    PartitionId?: string | undefined;
}

export class AwsOrganizationWriter {
    private organization: AwsOrganization;
    private organizationsService: Organizations.OrganizationsClient;

    constructor(organizationsService: Organizations.OrganizationsClient, organization: AwsOrganization, private readonly crossAccountConfig?: ICrossAccountConfig) {
        this.organizationsService = organizationsService;
        this.organization = organization;
    }

    public async ensureSCPEnabled(): Promise<void> {
        return await performAndRetryIfNeeded(async () => {
            const org: Organizations.OrganizationsClient = this.organizationsService;

            const enablePolicyTypeCommand = new Organizations.EnablePolicyTypeCommand({
                RootId: this.organization.roots[0].Id!,
                PolicyType: 'SERVICE_CONTROL_POLICY',
            });


            try {
                await org.send(enablePolicyTypeCommand);
                ConsoleUtil.LogDebug('enabled service control policies');
            } catch (err) {
                if (err && err.name === 'PolicyTypeAlreadyEnabledException') {
                    // do nothing
                } else {
                    throw err;
                }
            }
        });
    }

    public async createPolicy(resource: ServiceControlPolicyResource): Promise<string> {
        return await performAndRetryIfNeeded(async () => {
            try {
                const createPolicyCommand = new Organizations.CreatePolicyCommand({
                    Name: resource.policyName,
                    Description: resource.description!,
                    Type: 'SERVICE_CONTROL_POLICY',
                    Content: JSON.stringify(resource.policyDocument, null, 2),
                });
                const response = await this.organizationsService.send(createPolicyCommand);
                const scpId = response.Policy!.PolicySummary!.Id!;
                ConsoleUtil.LogDebug(`SCP Created ${scpId}`);
                return scpId;
            } catch (err) {
                if (err.name === 'DuplicatePolicyException') {
                    const existingPolicy: AWSPolicy = this.organization.policies.find(x => x.Name === resource.policyName);
                    const scpId = existingPolicy!.Id;
                    await this.updatePolicy(resource, scpId);
                    ConsoleUtil.LogDebug(`SCP found ${scpId}`);
                    return scpId;
                }

                throw err;
            }
        });
    }

    public async attachPolicy(targetPhysicalId: string, policyPhysicalId: string): Promise<void> {
        return await performAndRetryIfNeeded(async () => {
            const org: Organizations.OrganizationsClient = this.organizationsService;
            const attachPolicyCommand = new Organizations.AttachPolicyCommand({
                PolicyId: policyPhysicalId,
                TargetId: targetPhysicalId,
            });
            try {
                try {
                    await this.ensureSCPEnabled();
                    await org.send(attachPolicyCommand);
                } catch (err) {
                    if (err && err.name === 'PolicyTypeNotEnabledException') {
                        await this.ensureSCPEnabled();
                        await org.send(attachPolicyCommand);
                    } else {
                        throw err;
                    }
                }
            } catch (err) {
                if (err && err.name !== 'DuplicatePolicyAttachmentException') {
                    throw err;
                }
            }
        });
    }

    public async detachPolicy(targetPhysicalId: string, policyPhysicalId: string): Promise<void> {
        return await performAndRetryIfNeeded(async () => {
            const detachPolicyCommand = new Organizations.DetachPolicyCommand({
                PolicyId: policyPhysicalId,
                TargetId: targetPhysicalId,
            });
            try {
                await this.organizationsService.send(detachPolicyCommand);
            } catch (err) {
                if (err && err.name !== 'PolicyNotAttachedException' && err.name !== 'PolicyNotFoundException') {
                    // 'ConcurrentModificationException' ??
                    throw err;
                }
            }
        });
    }

    public async updatePolicy(resource: ServiceControlPolicyResource, physicalId: string): Promise<void> {
        return await performAndRetryIfNeeded(async () => {
            const updatePolicyCommand = new Organizations.UpdatePolicyCommand({
                PolicyId: physicalId,
                Name: resource.policyName,
                Description: resource.description,
                Content: JSON.stringify(resource.policyDocument, null, 2),
            });
            await this.organizationsService.send(updatePolicyCommand);
        });
    }

    public async deletePolicy(physicalId: string): Promise<void> {
        return await performAndRetryIfNeeded(async () => {
            const deletePolicyCommand = new Organizations.DeletePolicyCommand({
                PolicyId: physicalId,
            });
            try {
                await this.organizationsService.send(deletePolicyCommand);
            } catch (err) {
                if (err && err.name !== 'PolicyNotFoundException' && err.name !== 'PolicyInUseException') {
                    // 'ConcurrentModificationException' ??
                    throw err;
                }
            }
        });
    }

    public async detachAccount(targetId: string, accountId: string): Promise<void> {
        const root = await this.ensureRoot();
        await this.attachAccount(root, accountId);
    }

    public async attachAccount(parentPhysicalId: string, accountPhysicalId: string): Promise<void> {
        return await performAndRetryIfNeeded(async () => {
            const account: AWSAccount = this.organization.accounts.find(x => x.Id === accountPhysicalId);
            let parentId: string;
            if (account !== undefined) {
                parentId = account.ParentId;
            } else {
                const listParentsCommand = new Organizations.ListParentsCommand({
                    ChildId: accountPhysicalId,
                });
                const accountFromAws = await this.organizationsService.send(listParentsCommand);
                parentId = accountFromAws.Parents[0].Id;
            }
            if (parentId === parentPhysicalId) {
                ConsoleUtil.LogDebug(`account ${accountPhysicalId} already has parent ${parentPhysicalId}`);
                return;
            }
            const moveAccountCommand = new Organizations.MoveAccountCommand({
                SourceParentId: parentId,
                DestinationParentId: parentPhysicalId,
                AccountId: accountPhysicalId,
            });

            await this.organizationsService.send(moveAccountCommand);

            // account will be undefined if account is suspended.
            // still needs to be moved when e.g. OU gets re-attached.
            if (account !== undefined) {
                account.ParentId = parentPhysicalId;
            }
        });
    }

    public async detachOU(targetId: string, childOuPhysicalId: string): Promise<Record<string, string>> {
        const root = await this.ensureRoot();
        return await this.moveOU(root, childOuPhysicalId);
    }

    public async moveOU(parentPhysicalId: string, childOuPhysicalId: string, mappedOUIds: Record<string, string> = {}): Promise<Record<string, string>> {
        const ouList: AWSOrganizationalUnit[] = this.organization.organizationalUnits;

        const organizationalUnitName = await performAndRetryIfNeeded(async () => {
            ConsoleUtil.LogDebug(`calling describe ou for child ${childOuPhysicalId}`);

            const describeOrgUnitCommand = new Organizations.DescribeOrganizationalUnitCommand({
                OrganizationalUnitId: childOuPhysicalId,
            });

            const childOu = await this.organizationsService.send(describeOrgUnitCommand);
            return childOu.OrganizationalUnit.Name;
        });

        return await performAndRetryIfNeeded(async () => {
            ConsoleUtil.LogDebug(`moving from OU named ${organizationalUnitName}, Id: ${childOuPhysicalId}`);

            const updateOrganizationalUnitCommand = new Organizations.UpdateOrganizationalUnitCommand({
                OrganizationalUnitId: childOuPhysicalId,
                Name: organizationalUnitName + '_tmp',
            });
            await this.organizationsService.send(updateOrganizationalUnitCommand);
            ConsoleUtil.LogDebug(`renamed OU to ${updateOrganizationalUnitCommand.input.Name}`);
            const createOrganizationalUnitCommand = new Organizations.CreateOrganizationalUnitCommand({
                Name: organizationalUnitName,
                ParentId: parentPhysicalId,
            });
            const targetOrganizationalUnit = await this.organizationsService.send(createOrganizationalUnitCommand);
            const targetOrganizationalUnitId = targetOrganizationalUnit.OrganizationalUnit.Id;

            mappedOUIds[childOuPhysicalId] = targetOrganizationalUnitId;
            ConsoleUtil.LogDebug(`created new OU named ${organizationalUnitName}, Id ${targetOrganizationalUnitId}`);

            await this._moveOuChildren(childOuPhysicalId, targetOrganizationalUnitId, mappedOUIds);
            ConsoleUtil.LogDebug(`done moving children from ${childOuPhysicalId} to ${targetOrganizationalUnitId}`);

            const deleteOrganizationalUnitCommand = new Organizations.DeleteOrganizationalUnitCommand({
                OrganizationalUnitId: childOuPhysicalId,
            });

            await this.organizationsService.send(deleteOrganizationalUnitCommand);

            try {
                const organizationalUnit = ouList.find(x => x.Id === childOuPhysicalId);
                if (organizationalUnit === undefined) {
                    ConsoleUtil.LogWarning(`while moving OU unable to find ou with ${childOuPhysicalId} in internal model.`);
                } else {

                    organizationalUnit.Id = targetOrganizationalUnitId;

                    const oldParent = ouList.find(x => x.OrganizationalUnits.includes(organizationalUnit));
                    if (oldParent !== undefined) {
                        oldParent.OrganizationalUnits.push(organizationalUnit);
                    }

                    const parentOrganizationalOU = ouList.find(x => x.Id === parentPhysicalId);
                    if (parentOrganizationalOU !== undefined) {
                        parentOrganizationalOU.OrganizationalUnits.push(organizationalUnit);
                    }
                }
            } catch (err) {
                ConsoleUtil.LogWarning(`unable to update internal model. ${err}`);
            }


            return mappedOUIds;
        });
    }

    public async ensureRoot(): Promise<string> {
        return this.organization.roots[0].Id;
    }

    public async createOrganizationalUnit(resource: OrganizationalUnitResource, parentId?: string): Promise<string> {
        return await performAndRetryIfNeeded(async () => {
            if (parentId === undefined) {
                parentId = await this.ensureRoot();
            }

            const existingOu = this.organization.organizationalUnits.find(x => x.ParentId === parentId && x.Name === resource.organizationalUnitName);
            if (existingOu) {
                ConsoleUtil.LogDebug(`ou with name ${resource.organizationalUnitName} already exists (Id: ${existingOu.Id}).`);
                return existingOu.Id;
            }

            const newOu = await this._createOrganizationalUnit(resource, parentId);
            this.organization.organizationalUnits.push(newOu);
            ConsoleUtil.LogDebug(`organizational unit ${resource.organizationalUnitName} created (Id: ${newOu.Id}).`);
            return newOu.Id;
        });
    }

    public async updateOrganizationalUnit(resource: OrganizationalUnitResource, physicalId: string): Promise<void> {
        return await performAndRetryIfNeeded(async () => {
            const updateOrganizationalUnitCommand = new Organizations.UpdateOrganizationalUnitCommand({
                OrganizationalUnitId: physicalId,
                Name: resource.organizationalUnitName,
            });
            await this.organizationsService.send(updateOrganizationalUnitCommand);
        });
    }

    public async deleteOrganizationalUnit(physicalId: string): Promise<void> {
        return await performAndRetryIfNeeded(async () => {
            const existingOU = this.organization.organizationalUnits.find(x => x.Id === physicalId);
            if (existingOU === undefined) {
                ConsoleUtil.LogDebug(`can't delete organizational unit ${physicalId} not found.`);
                return;
            }
            const root = await this.ensureRoot();

            this._moveOuChildren(physicalId, root, {}, true);

            const deleteOrganizationalUnitCommand = new Organizations.DeleteOrganizationalUnitCommand({
                OrganizationalUnitId: physicalId,
            });
            await this.organizationsService.send(deleteOrganizationalUnitCommand);
        });
    }

    public async createAccount(resource: AccountResource): Promise<PartitionCreateResponse> {

        let accountId = resource.accountId;

        // todo and check on accountId
        const account: AWSAccount = [...this.organization.accounts, this.organization.masterAccount].find(x => x.Id === resource.accountId || x.Email === resource.rootEmail);
        if (account !== undefined) {
            await this.updateAccount(resource, account.Id);
            ConsoleUtil.LogDebug(`account with email ${resource.rootEmail} was already part of the organization (accountId: ${account.Id}).`);
            return { PhysicalId: account.Id };
        }

        accountId = await this._createAccount(resource);

        let retryCountAccessDenied = 0;
        let shouldRetry = false;
        do {
            shouldRetry = false;
            try {
                await this.updateAccount(resource, accountId);
            } catch (err) {
                if ((err.name === 'AccessDenied' || err.name === 'InvalidClientTokenId') && retryCountAccessDenied < 3) {
                    shouldRetry = true;
                    retryCountAccessDenied = retryCountAccessDenied + 1;
                    await sleep(3000);
                    continue;
                }
                throw err;
            }
        } while (shouldRetry);
        await AwsEvents.putAccountCreatedEvent(accountId);

        return { PhysicalId: accountId };
    }

    public async createPartitionAccount(resource: AccountResource, partitionWriter: AwsOrganizationWriter): Promise<PartitionCreateResponse> {

        const account: AWSAccount = [...this.organization.accounts, this.organization.masterAccount].find(x => x.Id === resource.accountId || x.Email === resource.rootEmail);
        if (account !== undefined) {
            const partitionAccount = (await partitionWriter._listAccounts()).find(x => x.Email === account.Email);
            await this.updateAccount(resource, account.Id);
            await partitionWriter.updateAccount(resource, partitionAccount.Id);

            ConsoleUtil.LogDebug(`account with email ${resource.rootEmail} was already part of the organization (accountId: ${account.Id}).`);
            return {
                PhysicalId: account.Id,
                PartitionId: partitionAccount.Id,
            };
        }

        const result = await this._createPartitionAccount(resource, partitionWriter);

        let retryCountAccessDenied = 0;
        let shouldRetry = false;
        do {
            shouldRetry = false;
            try {
                await this.updateAccount(resource, result.AccountId);
                await partitionWriter.updateAccount(resource, result.GovCloudAccountId);
            } catch (err) {
                if ((err.name === 'AccessDenied' || err.name === 'InvalidClientTokenId') && retryCountAccessDenied < 3) {
                    shouldRetry = true;
                    retryCountAccessDenied = retryCountAccessDenied + 1;
                    await sleep(3000);
                    continue;
                }
                throw err;
            }
        } while (shouldRetry);
        // await AwsEvents.putAccountCreatedEvent(accountId);

        return {
            PhysicalId: result.AccountId,
            PartitionId: result.GovCloudAccountId,
        };
    }

    public async updateAccount(resource: AccountResource, accountId: string, previousResource?: AccountResource): Promise<void> {
        const account: AWSAccount = [...this.organization.accounts, this.organization.masterAccount].find(x => x.Id === accountId);

        if (account.Name !== resource.accountName) {
            ConsoleUtil.LogWarning(`account name for ${accountId} (logicalId: ${resource.logicalId}) cannot be changed from '${account.Name}' to '${resource.accountName}'. Instead: login with root on the specified account to change its name`);
        }

        if (previousResource && previousResource.organizationAccessRoleName !== resource.organizationAccessRoleName) {
            ConsoleUtil.LogWarning(`when changing the organization access role for ${accountId} (logicalId: ${resource.logicalId}) the tool will not automatically rename roles in the target account. Instead: make sure that the name of the role in the organization model corresponds to a role in the AWS account.`);
        }

        if (previousResource?.alias !== resource.alias) {
            const assumeRoleConfig = await GetOrganizationAccessRoleInTargetAccount(this.crossAccountConfig, accountId);
            const iam = await AwsUtil.GetIamService(accountId, assumeRoleConfig.role, assumeRoleConfig.viaRole, (account.Type === 'PartitionAccount'));
            const alias = (account.Type === 'PartitionAccount') ? resource.partitionAlias : resource.alias;
            if (account.Alias) {
                try {
                    const deleteAccountAliasCommand = new IAM.DeleteAccountAliasCommand({
                        AccountAlias: account.Alias,
                    });
                    await iam.send(deleteAccountAliasCommand);
                } catch (err) {
                    if (err && err.name !== 'NoSuchEntity') {
                        throw err;
                    }
                }
            }
            if (alias) {
                try {
                    const createAccountAliasCommand = new IAM.CreateAccountAliasCommand({
                        AccountAlias: alias,
                    });

                    await iam.send(createAccountAliasCommand);
                } catch (err) {
                    const current = await iam.send(new IAM.ListAccountAliasesCommand({}));
                    if (current.AccountAliases.find(x => x === alias)) {
                        return;
                    }
                    if (err && err.name === 'EntityAlreadyExists') {
                        throw new OrgFormationError(`The account alias ${alias} already exists. Most likely someone else already registered this alias to some other account.`);
                    }
                }
            }
        }

        if (resource.supportLevel !== undefined) {
            let currentSupportLevel = 'basic';
            if (previousResource !== undefined && previousResource.supportLevel !== undefined) {
                currentSupportLevel = previousResource.supportLevel;
            } else if (account.SupportLevel !== undefined) {
                currentSupportLevel = account.SupportLevel;
            }

            if (currentSupportLevel !== resource.supportLevel) {
                const masterAccountSupportLevel = this.organization.masterAccount.SupportLevel;
                if (masterAccountSupportLevel !== resource.supportLevel) {
                    throw new OrgFormationError(`account ${resource.logicalId} specifies support level ${resource.supportLevel}, expected is support level ${masterAccountSupportLevel}, based on the support subscription for the organization master account.`);
                } else {
                    try {
                        const targetAccountId = this.organization.masterAccount.Id;
                        const assumeRoleConfig = await GetOrganizationAccessRoleInTargetAccount(this.crossAccountConfig, targetAccountId);
                        const support = AwsUtil.GetSupportService(targetAccountId, assumeRoleConfig.role, assumeRoleConfig.viaRole, (account.Type === 'PartitionAccount'));
                        const createCaseCommand = new CreateCaseCommand({
                            subject: `Enable ${resource.supportLevel} Support for account: ${accountId}`,
                            communicationBody: `Hi AWS,
    Please enable ${resource.supportLevel} on account ${accountId}.
    This case was created automatically - please resolve when done.

    Thank you!
                            `,
                            serviceCode: 'customer-account',
                            categoryCode: 'other-account-issues',
                            severityCode: 'low',
                            issueType: 'customer-service',
                            ccEmailAddresses: [resource.rootEmail],
                        });
                        const response = await support.send(createCaseCommand);
                        ConsoleUtil.LogDebug(`created support ticket, case id: ${response.caseId}`);
                    } catch (err) {
                        ConsoleUtil.LogDebug(`error creating support ticket. code: ${err?.code}, message: ${err?.message}`);
                    }
                }
            }
        }

        if (!passwordPolicyEquals(previousResource?.passwordPolicy, resource.passwordPolicy)) {
            const assumeRoleConfig = await GetOrganizationAccessRoleInTargetAccount(this.crossAccountConfig, accountId);
            const iam = await AwsUtil.GetIamService(accountId, assumeRoleConfig.role, assumeRoleConfig.viaRole, (account.Type === 'PartitionAccount'));
            if (account.PasswordPolicy && !resource.passwordPolicy?.TemplateResource) {
                try {
                    await iam.send(new IAM.DeleteAccountPasswordPolicyCommand({}));
                } catch (err) {
                    if (err && err.name !== 'NoSuchEntity') {
                        throw err;
                    }
                }
            }
            if (resource.passwordPolicy && resource.passwordPolicy.TemplateResource) {
                const passwordPolicy = resource.passwordPolicy.TemplateResource;

                const updateAccountPasswordPolicyCommand = new IAM.UpdateAccountPasswordPolicyCommand({
                    MinimumPasswordLength: passwordPolicy.minimumPasswordLength,
                    RequireSymbols: passwordPolicy.requireSymbols,
                    RequireNumbers: passwordPolicy.requireNumbers,
                    RequireUppercaseCharacters: passwordPolicy.requireUppercaseCharacters,
                    RequireLowercaseCharacters: passwordPolicy.requireLowercaseCharacters,
                    MaxPasswordAge: passwordPolicy.maxPasswordAge,
                    PasswordReusePrevention: passwordPolicy.passwordReusePrevention,
                    AllowUsersToChangePassword: passwordPolicy.allowUsersToChangePassword,
                });

                await iam.send(updateAccountPasswordPolicyCommand);
            }
        }

        const tagsOnResource = Object.entries(resource.tags || {});
        const keysOnResource = tagsOnResource.map(x => x[0]);
        const tagsOnAccount = Object.entries(account.Tags);
        const tagsToRemove = tagsOnAccount.map(x => x[0]).filter(x => keysOnResource.indexOf(x) === -1);
        const tagsToUpdate = keysOnResource.filter(x => resource.tags[x] !== account.Tags[x]);

        if (tagsToRemove.length > 0) {
            const untagResourceCommand = new Organizations.UntagResourceCommand({
                ResourceId: accountId,
                TagKeys: tagsToRemove,
            });
            await this.organizationsService.send(untagResourceCommand);
        }

        if (tagsToUpdate.length > 0) {
            const tags: Organizations.Tag[] = tagsOnResource.filter(x => tagsToUpdate.indexOf(x[0]) >= 0).map(x => ({ Key: x[0], Value: (x[1] || '').toString() }));

            const tagResourceCommand = new Organizations.TagResourceCommand({
                ResourceId: accountId,
                Tags: tags,
            });
            await this.organizationsService.send(tagResourceCommand);
        }

        if (!this.organization.masterAccount.PartitionId) {
            account.Tags = resource.tags;
        }
    }

    public async closeAccount(physicalId: string): Promise<void> {
        return await performAndRetryIfNeeded(async () => {
            const existingAccount = this.organization.accounts.find(x => x.Id === physicalId);
            if (existingAccount === undefined) {
                ConsoleUtil.LogWarning(`Error, can't delete account ${physicalId}, account not found.`);
                return;
            }

            const closeAccountCommand = new Organizations.CloseAccountCommand({
                AccountId: physicalId,
            });
            await this.organizationsService.send(closeAccountCommand);
            let account: Organizations.Account = { Status: 'PENDING_CLOSURE' };
            while (account.Status !== 'SUSPENDED') {
                if (account.Status === 'ACTIVE') {
                    throw new OrgFormationError('deleting account failed');
                }
                const describeAccountStatusCommand = new Organizations.DescribeAccountCommand({
                    AccountId: physicalId,
                });
                await sleep(1000);
                const response = await this.organizationsService.send(describeAccountStatusCommand);
                account = response.Account;
            }
        });
    }

    private async _createOrganizationalUnit(resource: OrganizationalUnitResource, parentId: string): Promise<AWSOrganizationalUnit> {
        return await performAndRetryIfNeeded(async () => {
            const createOrganizationalUnitCommand = new Organizations.CreateOrganizationalUnitCommand({
                Name: resource.organizationalUnitName,
                ParentId: parentId,
            });

            const ou = await this.organizationsService.send(createOrganizationalUnitCommand);
            const output: AWSOrganizationalUnit = {
                Arn: ou.OrganizationalUnit.Arn,
                Id: ou.OrganizationalUnit.Id,
                ParentId: parentId,
                Policies: [],
                Name: resource.organizationalUnitName,
                Type: 'OrganizationalUnit',
                Accounts: [],
                OrganizationalUnits: [],
            };

            return output;
        });
    }

    private async _createAccount(resource: AccountResource): Promise<string> {
        return await performAndRetryIfNeeded(async () => {
            const createAccountCommandInput: Organizations.CreateAccountCommandInput = {
                Email: resource.rootEmail,
                AccountName: resource.accountName,
            };

            if (typeof resource.organizationAccessRoleName === 'string') {
                createAccountCommandInput.RoleName = resource.organizationAccessRoleName;
            }

            const createAccountResponse = await this.organizationsService.send(new Organizations.CreateAccountCommand(createAccountCommandInput));

            let accountCreationStatus = createAccountResponse.CreateAccountStatus;
            while (accountCreationStatus.State !== 'SUCCEEDED') {
                if (accountCreationStatus.State === 'FAILED') {
                    throw new OrgFormationError('creating account failed, reason: ' + accountCreationStatus.FailureReason);
                }
                const describeAccountStatusCommand = new Organizations.DescribeCreateAccountStatusCommand({
                    CreateAccountRequestId: createAccountResponse.CreateAccountStatus.Id,
                });
                await sleep(1000);
                const response = await this.organizationsService.send(describeAccountStatusCommand);
                accountCreationStatus = response.CreateAccountStatus;
            }

            await this._pushAccount(resource, accountCreationStatus.AccountId, 'Account');
            return accountCreationStatus.AccountId;
        });
    }

    private async _createPartitionAccount(resource: AccountResource, partitionWriter: AwsOrganizationWriter): Promise<Organizations.CreateAccountStatus> {
        return await performAndRetryIfNeeded(async () => {
            const createGovCloudAccountCommandInput: Organizations.CreateGovCloudAccountCommandInput = {
                Email: resource.rootEmail,
                AccountName: resource.accountName,
            };

            if (typeof resource.organizationAccessRoleName === 'string') {
                createGovCloudAccountCommandInput.RoleName = resource.organizationAccessRoleName;
            }

            const createAccountsResponse = await this.organizationsService.send(new Organizations.CreateGovCloudAccountCommand(createGovCloudAccountCommandInput));

            let accountCreationStatus = createAccountsResponse.CreateAccountStatus;
            while (accountCreationStatus.State !== 'SUCCEEDED') {
                if (accountCreationStatus.State === 'FAILED') {
                    throw new OrgFormationError('creating account failed, reason: ' + accountCreationStatus.FailureReason);
                }
                const describeAccountStatusCommand = new Organizations.DescribeCreateAccountStatusCommand({
                    CreateAccountRequestId: createAccountsResponse.CreateAccountStatus.Id,
                });
                await sleep(1000);
                const response = await this.organizationsService.send(describeAccountStatusCommand);
                accountCreationStatus = response.CreateAccountStatus;
            }

            await this._pushAccount(resource, accountCreationStatus.AccountId, 'Account');
            await partitionWriter._pushAccount(resource, accountCreationStatus.GovCloudAccountId, 'PartitionAccount');

            try {
                await partitionWriter._inviteToPartitionOrg(accountCreationStatus);
            } catch (err) {
                ConsoleUtil.LogWarning(`Error inviting account to organization. You may have to manually invite ${accountCreationStatus.GovCloudAccountId} to the GovCloud organization.`);
                ConsoleUtil.LogWarning(err);
                ConsoleUtil.LogWarning('Ignoring error and moving on...');
            }
            return accountCreationStatus;
        });
    }

    public async _inviteToPartitionOrg(accountCreationStatus: Organizations.CreateAccountStatus): Promise<void> {
        const inviteAccountToOrgCommand = new Organizations.InviteAccountToOrganizationCommand({
            Target: {
                Id: accountCreationStatus.GovCloudAccountId,
                Type: 'ACCOUNT',
            },
        });

        await this.organizationsService.send(inviteAccountToOrgCommand);
        const assumeRoleConfig = await GetOrganizationAccessRoleInTargetAccount(this.crossAccountConfig, accountCreationStatus.GovCloudAccountId);
        const org = AwsUtil.GetOrganizationsService(accountCreationStatus.GovCloudAccountId, assumeRoleConfig.role, assumeRoleConfig.viaRole, true);

        const handshakeList = await org.send(new Organizations.ListHandshakesForAccountCommand({}));
        await org.send(new Organizations.AcceptHandshakeCommand({ HandshakeId: handshakeList.Handshakes[0].Id }));
    }

    public async _pushAccount(resource: AccountResource, accountId: string, type: string): Promise<void> {
        this.organization.accounts.push({
            Arn: `arn:aws:organizations::${this.organization.masterAccount.Id}:account/${this.organization.organization.Id}/${accountId}`,
            Id: accountId,
            ParentId: this.organization.roots[0].Id,
            Policies: [],
            Name: resource.accountName,
            Email: resource.rootEmail,
            Type: type,
            Tags: {},
            SupportLevel: 'basic',
        });
    }

    private async _moveOuChildren(sourceId: string, targetId: string, mappedOUIds: Record<string, string>, onlyAccounts = false): Promise<void> {
        const listAccountsOfPreviousOUCommandInput: Organizations.ListAccountsForParentCommandInput = { ParentId: sourceId };
        let listAccountsOfPreviousOU: Organizations.ListAccountsForParentCommandOutput;
        do {
            listAccountsOfPreviousOU = await this.organizationsService.send(
                new Organizations.ListAccountsForParentCommand(listAccountsOfPreviousOUCommandInput)
            );
            for (const account of listAccountsOfPreviousOU.Accounts) {
                ConsoleUtil.LogDebug(`moving account ${account.Name} from ou ${sourceId} to ou ${targetId}`);
                await this.attachAccount(targetId, account.Id);
            }
            listAccountsOfPreviousOUCommandInput.NextToken = listAccountsOfPreviousOUCommandInput.NextToken;
        } while (listAccountsOfPreviousOU.NextToken);

        if (!onlyAccounts) {

            const listServiceControlPoliciesOfPreviousOUCommandInput: Organizations.ListPoliciesForTargetCommandInput = { TargetId: sourceId, Filter: 'SERVICE_CONTROL_POLICY' };
            let listServiceControlPoliciesOfPreviousOU: Organizations.ListPoliciesForTargetCommandOutput;
            do {
                listServiceControlPoliciesOfPreviousOU = await this.organizationsService.send(
                    new Organizations.ListPoliciesForTargetCommand(listServiceControlPoliciesOfPreviousOUCommandInput)
                );
                for (const scp of listServiceControlPoliciesOfPreviousOU.Policies.filter(x => x.Id !== 'p-FullAWSAccess')) {
                    ConsoleUtil.LogDebug(`moving scp (${scp.Id}) from ou ${sourceId} to ou ${targetId}`);
                    const attachPromise = this.organizationsService.send(
                        new Organizations.AttachPolicyCommand({ PolicyId: scp.Id, TargetId: targetId })
                    );
                    const detachPromise = this.organizationsService.send(
                        new Organizations.DetachPolicyCommand({ PolicyId: scp.Id, TargetId: sourceId })
                    );
                    await Promise.all([attachPromise, detachPromise]);
                }
            } while (listServiceControlPoliciesOfPreviousOU.NextToken);

            const listChildUnitsOfPreviousOUCommandInput: Organizations.ListOrganizationalUnitsForParentCommandInput = { ParentId: sourceId };
            let childUnitsOfPreviousOU: Organizations.ListOrganizationalUnitsForParentCommandOutput = await this.organizationsService.send(
                new Organizations.ListOrganizationalUnitsForParentCommand(listChildUnitsOfPreviousOUCommandInput)
            );
            do {
                childUnitsOfPreviousOU = await this.organizationsService.send(
                    new Organizations.ListOrganizationalUnitsForParentCommand(listChildUnitsOfPreviousOUCommandInput)
                );
                for (const child of childUnitsOfPreviousOU.OrganizationalUnits) {
                    ConsoleUtil.LogDebug(`moving child ou from ou ${sourceId} to ou ${targetId}`);
                    await this.moveOU(targetId, child.Id, mappedOUIds);
                }
            } while (childUnitsOfPreviousOU.NextToken);

        }
    }

    public async _listAccounts(): Promise<AWSAccount[]> {
        return this.organization.accounts;
    }
}
