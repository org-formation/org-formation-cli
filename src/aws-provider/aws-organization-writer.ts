import { IAM, Organizations, STS } from 'aws-sdk/clients/all';
import { AttachPolicyRequest, CreateAccountRequest, CreateAccountStatus, CreateOrganizationalUnitRequest, CreatePolicyRequest, DeleteOrganizationalUnitRequest, DeletePolicyRequest, DescribeCreateAccountStatusRequest, DetachPolicyRequest, EnablePolicyTypeRequest, ListAccountsForParentRequest, ListAccountsForParentResponse, ListOrganizationalUnitsForParentRequest, ListOrganizationalUnitsForParentResponse, ListPoliciesForTargetRequest, ListPoliciesForTargetResponse, MoveAccountRequest, Tag, TagResourceRequest, UntagResourceRequest, UpdateOrganizationalUnitRequest, UpdatePolicyRequest } from 'aws-sdk/clients/organizations';
import { CreateCaseRequest } from 'aws-sdk/clients/support';
import { Credentials } from 'aws-sdk';
import { CredentialsOptions } from 'aws-sdk/lib/credentials';
import { AwsUtil, passwordPolicyEquals } from '../util/aws-util';
import { ConsoleUtil } from '../util/console-util';
import { OrgFormationError } from '../org-formation-error';
import { AwsEvents } from './aws-events';
import { AwsOrganization } from './aws-organization';
import { AWSOrganizationalUnit } from './aws-organization-reader';
import { GetOrganizationAccessRoleInTargetAccount, ICrossAccountConfig } from './aws-account-access';
import { performAndRetryIfNeeded, sleep } from './util';
import {
    AccountResource,
    OrganizationalUnitResource,
    ServiceControlPolicyResource,
} from '~parser/model';

export interface PartitionCreateResponse {
    CommercialId: string;
    PartitionId?: string | undefined;
}

const IS_PARTITION = true;
const IS_COMMERCIAL = false;

export class AwsOrganizationWriter {

    private organization: AwsOrganization;
    private organizationService: Organizations;
    private partitionOrgService: Organizations;
    private partitionOrgSTS: STS;

    constructor(organizationService: Organizations, organization: AwsOrganization, private readonly crossAccountConfig?: ICrossAccountConfig, partitionCredentials?: CredentialsOptions) {

        this.organizationService = organizationService;
        this.organization = organization;
        console.log(organization);
        if (partitionCredentials) {
            this.partitionOrgService = new Organizations({ credentials: partitionCredentials, region: AwsUtil.GetPartitionRegion() });
            this.partitionOrgSTS = new STS({ credentials: partitionCredentials, region: AwsUtil.GetPartitionRegion() });
        }
    }

    public async ensureSCPEnabled(): Promise<void> {
        return await performAndRetryIfNeeded(async () => {
            const enablePolicyTypeReq: EnablePolicyTypeRequest = {
                RootId: this.organization.roots[0].Id!,
                PolicyType: 'SERVICE_CONTROL_POLICY',
            };
            try {
                await this.organizationService.enablePolicyType(enablePolicyTypeReq).promise();
                ConsoleUtil.LogDebug('enabled service control policies');
            } catch (err) {
                if (err && err.code === 'PolicyTypeAlreadyEnabledException') {
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
                const createPolicyRequest: CreatePolicyRequest = {
                    Name: resource.policyName,
                    Description: resource.description!,
                    Type: 'SERVICE_CONTROL_POLICY',
                    Content: JSON.stringify(resource.policyDocument, null, 2),
                };
                const response = await this.organizationService.createPolicy(createPolicyRequest).promise();
                const scpId = response.Policy!.PolicySummary!.Id!;
                ConsoleUtil.LogDebug(`SCP Created ${scpId}`);
                return scpId;
            } catch (err) {
                if (err.code === 'DuplicatePolicyException') {
                    const existingPolicy = this.organization.policies.find(x => x.Name === resource.policyName);
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
        });
    }

    public async detachPolicy(targetPhysicalId: string, policyPhysicalId: string): Promise<void> {
        return await performAndRetryIfNeeded(async () => {
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
        });
    }

    public async updatePolicy(resource: ServiceControlPolicyResource, physicalId: string): Promise<void> {
        return await performAndRetryIfNeeded(async () => {
            const updatePolicyRequest: UpdatePolicyRequest = {
                PolicyId: physicalId,
                Name: resource.policyName,
                Description: resource.description,
                Content: JSON.stringify(resource.policyDocument, null, 2),
            };
            await this.organizationService.updatePolicy(updatePolicyRequest).promise();
        });
    }

    public async deletePolicy(physicalId: string): Promise<void> {
        return await performAndRetryIfNeeded(async () => {
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
        });
    }

    public async detachAccount(targetId: string, accountId: string): Promise<void> {
        await this.attachAccount(this.organization.roots[0].Id, accountId);
    }

    public async attachAccount(parentPhysicalId: string, accountPhysicalId: string): Promise<void> {
        return await performAndRetryIfNeeded(async () => {
            const account = this.organization.accounts.find(x => x.Id === accountPhysicalId);
            let parentId: string;
            if (account !== undefined) {
                parentId = account.ParentId;
            } else {
                const accountFromAws = await this.organizationService.listParents({ ChildId: accountPhysicalId }).promise();
                parentId = accountFromAws.Parents[0].Id;

            }
            if (parentId === parentPhysicalId) {
                ConsoleUtil.LogDebug(`account ${accountPhysicalId} already has parent ${parentPhysicalId}`);
                return;
            }
            const moveAccountRequest: MoveAccountRequest = {
                SourceParentId: parentId,
                DestinationParentId: parentPhysicalId,
                AccountId: accountPhysicalId,
            };

            await this.organizationService.moveAccount(moveAccountRequest).promise();

            // account will be undefined if account is suspended.
            // still needs to be moved when e.g. OU gets re-attached.
            if (account !== undefined) {
                account.ParentId = parentPhysicalId;
            }
        });
    }

    public async detachOU(targetId: string, childOuPhysicalId: string): Promise<Record<string, string>> {
        return await this.moveOU(this.organization.roots[0].Id, childOuPhysicalId);
    }

    public async moveOU(parentPhysicalId: string, childOuPhysicalId: string, mappedOUIds: Record<string, string> = {}): Promise<Record<string, string>> {
        return await performAndRetryIfNeeded(async () => {
            ConsoleUtil.LogDebug(`calling describe ou for child ${childOuPhysicalId}`);

            const childOu = await this.organizationService.describeOrganizationalUnit({ OrganizationalUnitId: childOuPhysicalId }).promise();
            const organizationalUnitName = childOu.OrganizationalUnit.Name;

            ConsoleUtil.LogDebug(`moving from OU named ${organizationalUnitName}, Id: ${childOuPhysicalId}`);

            const updateOrganizationalUnitRequest: UpdateOrganizationalUnitRequest = {
                OrganizationalUnitId: childOuPhysicalId,
                Name: organizationalUnitName + '-org-formation-move-source',
            };
            await this.organizationService.updateOrganizationalUnit(updateOrganizationalUnitRequest).promise();
            ConsoleUtil.LogDebug(`renamed OU to ${updateOrganizationalUnitRequest.Name}`);

            const createOrganizationalUnitRequest: CreateOrganizationalUnitRequest = {
                Name: organizationalUnitName,
                ParentId: parentPhysicalId,
            };
            const targetOrganizationalUnit = await this.organizationService.createOrganizationalUnit(createOrganizationalUnitRequest).promise();
            const targetOrganizationalUnitId = targetOrganizationalUnit.OrganizationalUnit.Id;

            mappedOUIds[childOuPhysicalId] = targetOrganizationalUnitId;
            ConsoleUtil.LogDebug(`created new OU named ${organizationalUnitName}, Id ${targetOrganizationalUnitId}`);

            await this._moveOuChildren(childOuPhysicalId, targetOrganizationalUnitId, mappedOUIds);
            ConsoleUtil.LogDebug(`done moving children from ${childOuPhysicalId} to ${targetOrganizationalUnitId}`);

            const deleteOrganizationalUnitRequest: DeleteOrganizationalUnitRequest = {
                OrganizationalUnitId: childOuPhysicalId,
            };

            await this.organizationService.deleteOrganizationalUnit(deleteOrganizationalUnitRequest).promise();

            try {
                const organizationalUnit = this.organization.organizationalUnits.find(x => x.Id === childOuPhysicalId);
                if (organizationalUnit === undefined) {
                    ConsoleUtil.LogWarning(`while moving OU unable to find ou with ${childOuPhysicalId} in internal model.`);
                } else {

                    organizationalUnit.Id = targetOrganizationalUnitId;

                    const oldParent = this.organization.organizationalUnits.find(x => x.OrganizationalUnits.includes(organizationalUnit));
                    if (oldParent !== undefined) {
                        oldParent.OrganizationalUnits.push(organizationalUnit);
                    }

                    const parentOrganizationalOU = this.organization.organizationalUnits.find(x => x.Id === parentPhysicalId);
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
        const roots = this.organization.roots;
        return roots[0].Id;
    }

    public async createOrganizationalUnit(mirror: boolean, resource: OrganizationalUnitResource, parentId?: string): Promise<PartitionCreateResponse> {
        const commercialOuList: AWSOrganizationalUnit[] = this.organization.organizationalUnits;
        const partitionOuList: AWSOrganizationalUnit[] = this.organization.partitionOrganizationalUnits;
        for (const ou of commercialOuList) {
            ou.PartitionId = partitionOuList.find(x => x.Name === ou.Name)?.Id;
        }
        return await performAndRetryIfNeeded(async () => {
            if (parentId === undefined) {
                parentId = this.organization.roots[0].Id;
            };

            console.log(parentId);
            console.log(commercialOuList);

            const existingOu = commercialOuList.find(x => x.ParentId === parentId && x.Name === resource.organizationalUnitName);
            if (existingOu) {
                if (!mirror) {
                    ConsoleUtil.LogDebug(`ou with name ${resource.organizationalUnitName} already exists (Id: ${existingOu.Id}).`);
                    return {CommercialId: existingOu.Id};
                }

                const partitionOrganizationalUnit = partitionOuList.find(x =>
                    x.Name === resource.organizationalUnitName &&
                    x.Id === existingOu.PartitionId);

                if (partitionOrganizationalUnit) {
                    ConsoleUtil.LogDebug(`ou with name ${resource.organizationalUnitName} already exists (CommercialId: ${existingOu.Id}, PartitionId: ${existingOu.PartitionId}).`);
                    return {CommercialId: existingOu.Id, PartitionId: existingOu.PartitionId};
                }
                const partitionParentId = (existingOu.ParentId.startsWith('r-')) ?
                    this.organization.partitionRoots[0].Id :
                    commercialOuList.find(x => x.Id === existingOu.ParentId).PartitionId;

                const newPartitionOu = await this._createOrganizationalUnit(IS_PARTITION, resource, partitionParentId);
                ConsoleUtil.LogDebug(`ou with name ${resource.organizationalUnitName} already existed in commercial region. Mirror created in partition region (CommercialId: ${existingOu.Id}, PartitionId: ${existingOu.PartitionId}).`);
                return {CommercialId: existingOu.Id, PartitionId: newPartitionOu.Id};
            }

            const newCommercialOu = await this._createOrganizationalUnit(IS_COMMERCIAL, resource, parentId);
            ConsoleUtil.LogDebug(`organizational unit ${resource.organizationalUnitName} created (CommercialId: ${newCommercialOu.Id}), next is mirror.`);
            if (mirror) {
                const partitionParentId = (newCommercialOu.ParentId.startsWith('r-')) ?
                    this.organization.partitionRoots[0].Id :
                    commercialOuList.find(x => x.Id === newCommercialOu.ParentId).PartitionId;

                const newPartitionOu = await this._createOrganizationalUnit(IS_PARTITION, resource, partitionParentId);

                newCommercialOu.PartitionId = newPartitionOu.Id;
                newCommercialOu.PartitionArn = newPartitionOu.Arn;
                partitionOuList.push(newPartitionOu);
                commercialOuList.push(newCommercialOu);

                ConsoleUtil.LogDebug(`organizational units ${resource.organizationalUnitName} created (CommercialId: ${newCommercialOu.Id}, PartitionId: ${newPartitionOu.Id}).`);
                return {CommercialId: newCommercialOu.Id, PartitionId: newPartitionOu.Id};
            }

            commercialOuList.push(newCommercialOu);
            ConsoleUtil.LogDebug(`organizational unit ${resource.organizationalUnitName} created (Id: ${newCommercialOu.Id}).`);
            return {CommercialId: newCommercialOu.Id};
        });
    }

    public async updateOrganizationalUnit(resource: OrganizationalUnitResource, physicalId: string): Promise<void> {
        return await performAndRetryIfNeeded(async () => {
            const updateOrganizationalUnitRequest: UpdateOrganizationalUnitRequest = {
                OrganizationalUnitId: physicalId,
                Name: resource.organizationalUnitName,
            };
            await this.organizationService.updateOrganizationalUnit(updateOrganizationalUnitRequest).promise();
        });
    }

    public async deleteOrganizationalUnit(physicalId: string): Promise<void> {
        return await performAndRetryIfNeeded(async () => {
            const existingOU = this.organization.organizationalUnits.find(x => x.Id === physicalId);
            if (existingOU === undefined) {
                ConsoleUtil.LogDebug(`can't delete organizational unit ${physicalId} not found.`);
                return;
            }
            const root = this.organization.roots[0];

            this._moveOuChildren(physicalId, root.Id, {}, true);

            const deleteOrganizationalUnitRequest: DeleteOrganizationalUnitRequest = {
                OrganizationalUnitId: physicalId,
            };
            await this.organizationService.deleteOrganizationalUnit(deleteOrganizationalUnitRequest).promise();
        });
    }

    public async createAccount(resource: AccountResource): Promise<string> {

        let accountId = resource.accountId;

        // todo and check on accountId
        const account = [...this.organization.accounts, this.organization.masterAccount].find(x => x.Id === resource.accountId || x.Email === resource.rootEmail);
        if (account !== undefined) {
            await this.updateAccount(resource, account.Id);
            ConsoleUtil.LogDebug(`account with email ${resource.rootEmail} was already part of the organization (accountId: ${account.Id}).`);
            return account.Id;
        }

        accountId = await this._createAccount(resource);

        let retryCountAccessDenied = 0;
        let shouldRetry = false;
        do {
            shouldRetry = false;
            try {
                await this.updateAccount(resource, accountId);
            } catch (err) {
                if (err.code === 'AccessDenied' && retryCountAccessDenied < 3) {
                    shouldRetry = true;
                    retryCountAccessDenied = retryCountAccessDenied + 1;
                    await sleep(3000);
                    continue;
                }
                throw err;
            }
        } while (shouldRetry);
        await AwsEvents.putAccountCreatedEvent(accountId);

        return accountId;
    }

    public async createPartitionAccount(resource: AccountResource): Promise<PartitionCreateResponse> {

        const account = [...this.organization.accounts, this.organization.masterAccount].find(x => x.Id === resource.accountId && x.PartitionId === resource.partitionId);
        if (account !== undefined) {
            await this.updateAccount(resource, account.Id);
            await this.updatePartitionAccount(resource, account.PartitionId);

            ConsoleUtil.LogDebug(`account with email ${resource.rootEmail} was already part of the organization (accountId: ${account.Id}).`);
            return {
                CommercialId: account.Id,
                PartitionId: account.PartitionId,
            };
        }

        const result = await this._createPartitionAccount(resource);

        let retryCountAccessDenied = 0;
        let shouldRetry = false;
        do {
            shouldRetry = false;
            try {
                await this.updateAccount(resource, result.AccountId);
                await this.updatePartitionAccount(resource, result.GovCloudAccountId);
            } catch (err) {
                if (err.code === 'AccessDenied' && retryCountAccessDenied < 3) {
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
            CommercialId: result.AccountId,
            PartitionId: result.GovCloudAccountId,
        };
    }

    public async updateAccount(resource: AccountResource, accountId: string, previousResource?: AccountResource): Promise<void> {
        const account = [...this.organization.accounts, this.organization.masterAccount].find(x => x.Id === accountId);

        if (account.Name !== resource.accountName) {
            ConsoleUtil.LogWarning(`account name for ${accountId} (logicalId: ${resource.logicalId}) cannot be changed from '${account.Name}' to '${resource.accountName}'. Instead: login with root on the specified account to change its name`);
        }

        if (previousResource && previousResource.organizationAccessRoleName !== resource.organizationAccessRoleName) {
            ConsoleUtil.LogWarning(`when changing the organization access role for ${accountId} (logicalId: ${resource.logicalId}) the tool will not automatically rename roles in the target account. Instead: make sure that the name of the role in the organization model corresponds to a role in the AWS account.`);
        }

        if (previousResource?.alias !== resource.alias) {
            const assumeRoleConfig = await GetOrganizationAccessRoleInTargetAccount(this.crossAccountConfig, accountId);
            const iam = await AwsUtil.GetIamService(accountId, assumeRoleConfig.role, assumeRoleConfig.viaRole);
            if (account.Alias) {
                try {
                    await iam.deleteAccountAlias({ AccountAlias: account.Alias }).promise();
                } catch (err) {
                    if (err && err.code !== 'NoSuchEntity') {
                        throw err;
                    }
                }
            }
            if (resource.alias) {
                try {
                    await iam.createAccountAlias({ AccountAlias: resource.alias }).promise();
                } catch (err) {
                    const current = await iam.listAccountAliases({}).promise();
                    if (current.AccountAliases.find(x => x === resource.alias)) {
                        return;
                    }
                    if (err && err.code === 'EntityAlreadyExists') {
                        throw new OrgFormationError(`The account alias ${resource.alias} already exists. Most likely someone else already registered this alias to some other account.`);
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
                        const support = await AwsUtil.GetSupportService(targetAccountId, assumeRoleConfig.role, assumeRoleConfig.viaRole);
                        const createCaseRequest: CreateCaseRequest = {
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
                        };
                        const response = await support.createCase(createCaseRequest).promise();
                        ConsoleUtil.LogDebug(`created support ticket, case id: ${response.caseId}`);
                    } catch (err) {
                        ConsoleUtil.LogDebug(`error creating support ticket. code: ${err?.code}, message: ${err?.message}`);
                    }
                }
            }
        }

        if (!passwordPolicyEquals(previousResource?.passwordPolicy, resource.passwordPolicy)) {
            const assumeRoleConfig = await GetOrganizationAccessRoleInTargetAccount(this.crossAccountConfig, accountId);
            const iam = await AwsUtil.GetIamService(accountId, assumeRoleConfig.role, assumeRoleConfig.viaRole);
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
        const keysOnResource = tagsOnResource.map(x => x[0]);
        const tagsOnAccount = Object.entries(account.Tags);
        const tagsToRemove = tagsOnAccount.map(x => x[0]).filter(x => keysOnResource.indexOf(x) === -1);
        const tagsToUpdate = keysOnResource.filter(x => resource.tags[x] !== account.Tags[x]);

        if (tagsToRemove.length > 0) {
            const request: UntagResourceRequest = {
                ResourceId: accountId,
                TagKeys: tagsToRemove,
            };
            await this.organizationService.untagResource(request).promise();
        }

        if (tagsToUpdate.length > 0) {
            const tags: Tag[] = tagsOnResource.filter(x => tagsToUpdate.indexOf(x[0]) >= 0).map(x => ({ Key: x[0], Value: (x[1] || '').toString() }));

            const request: TagResourceRequest = {
                ResourceId: accountId,
                Tags: tags,
            };
            await this.organizationService.tagResource(request).promise();
        }

        if (!this.organization.masterAccount.PartitionId) {
            account.Tags = resource.tags;
        }
    }

    public async updatePartitionAccount(resource: AccountResource, accountId: string, previousResource?: AccountResource): Promise<void> {
        const account = [...this.organization.accounts, this.organization.masterAccount].find(x => x.PartitionId === accountId);

        if (account.Name !== resource.accountName) {
            ConsoleUtil.LogWarning(`account name for ${accountId} (logicalId: ${resource.logicalId}) cannot be changed from '${account.Name}' to '${resource.accountName}'. Instead: login with root on the specified account to change its name`);
        }

        if (previousResource && previousResource.organizationAccessRoleName !== resource.organizationAccessRoleName) {
            ConsoleUtil.LogWarning(`when changing the organization access role for ${accountId} (logicalId: ${resource.logicalId}) the tool will not automatically rename roles in the target account. Instead: make sure that the name of the role in the organization model corresponds to a role in the AWS account.`);
        }

        if (account.PartitionAlias !== resource.partitionAlias) {

            const assumeParams = {
                RoleArn: `arn:aws-us-gov:iam::${accountId}:role/OrganizationAccountAccessRole`,
                RoleSessionName: 'AssumeRoleSession',
            };
            const role = await this.partitionOrgSTS.assumeRole(assumeParams).promise();

            const iam = new IAM({
                credentials: {
                    accessKeyId: role.Credentials.AccessKeyId,
                    secretAccessKey: role.Credentials.SecretAccessKey,
                    sessionToken: role.Credentials.SessionToken,
                },
                region: AwsUtil.GetPartitionRegion(),
            });

            if (account.PartitionAlias) {
                try {
                    await iam.deleteAccountAlias({ AccountAlias: account.PartitionAlias }).promise();
                } catch (err) {
                    if (err && err.code !== 'NoSuchEntity') {
                        throw err;
                    }
                }
            }

            if (resource.partitionAlias) {
                try {
                    await iam.createAccountAlias({ AccountAlias: resource.partitionAlias }).promise();
                } catch (err) {
                    const current = await iam.listAccountAliases({}).promise();
                    if (current.AccountAliases.find(x => x === resource.partitionAlias)) {
                        return;
                    }
                    if (err && err.code === 'EntityAlreadyExists') {
                        throw new OrgFormationError(`The account alias ${resource.partitionAlias} already exists. Most likely someone else already registered this alias to some other account.`);
                    }
                }
            }
        }

        const tagsOnResource = Object.entries(resource.tags || {});
        const keysOnResource = tagsOnResource.map(x => x[0]);
        const tagsOnAccount = Object.entries(account.Tags || {});
        const tagsToRemove = tagsOnAccount.map(x => x[0]).filter(x => keysOnResource.indexOf(x) === -1);
        const tagsToUpdate = keysOnResource.filter(x => resource.tags[x] !== account.Tags[x]);

        if (tagsToRemove.length > 0) {
            const request: UntagResourceRequest = {
                ResourceId: accountId,
                TagKeys: tagsToRemove,
            };
            await this.partitionOrgService.untagResource(request).promise();
        }

        if (tagsToUpdate.length > 0) {
            const tags: Tag[] = tagsOnResource.filter(x => tagsToUpdate.indexOf(x[0]) >= 0).map(x => ({ Key: x[0], Value: (x[1] || '').toString() }));

            const request: TagResourceRequest = {
                ResourceId: accountId,
                Tags: tags,
            };
            await this.partitionOrgService.tagResource(request).promise();
        }

        account.Tags = resource.tags;
    }


    private async _createOrganizationalUnit(isPartition: boolean, resource: OrganizationalUnitResource, parentId: string): Promise<AWSOrganizationalUnit> {
        return await performAndRetryIfNeeded(async () => {
            const org: Organizations = (isPartition) ?  this.partitionOrgService : this.organizationService;
            const orgId: string = (isPartition) ? this.organization.partitionOrganization.Id : this.organization.organization.Id;
            const masterAccountId: string = (isPartition) ?  this.organization.partitionMasterAccount.Id : this.organization.masterAccount.Id;

            const createOrganizationalUnitRequest: CreateOrganizationalUnitRequest = {
                Name: resource.organizationalUnitName,
                ParentId: parentId,
            };

            console.log(createOrganizationalUnitRequest);

            const ou = await org.createOrganizationalUnit(createOrganizationalUnitRequest).promise();
            const output: AWSOrganizationalUnit = {
                Arn: `arn:aws:organizations::${masterAccountId}:ou/${orgId}/${ou.OrganizationalUnit.Id}`,
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
            const createAccountReq: CreateAccountRequest = {
                Email: resource.rootEmail,
                AccountName: resource.accountName,
            };

            if (typeof resource.organizationAccessRoleName === 'string') {
                createAccountReq.RoleName = resource.organizationAccessRoleName;
            }

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
                SupportLevel: 'basic',
            });

            return accountCreationStatus.AccountId;
        });
    }

    private async _createPartitionAccount(resource: AccountResource): Promise<CreateAccountStatus> {

        return await performAndRetryIfNeeded(async () => {
            const createAccountReq: CreateAccountRequest = {
                Email: resource.rootEmail,
                AccountName: resource.accountName,
            };

            if (typeof resource.organizationAccessRoleName === 'string') {
                createAccountReq.RoleName = resource.organizationAccessRoleName;
            }

            const createAccountsResponse = await this.organizationService.createGovCloudAccount(createAccountReq).promise();

            let accountCreationStatus = createAccountsResponse.CreateAccountStatus;
            while (accountCreationStatus.State !== 'SUCCEEDED') {
                if (accountCreationStatus.State === 'FAILED') {
                    throw new OrgFormationError('creating account failed, reason: ' + accountCreationStatus.FailureReason);
                }
                const describeAccountStatusReq: DescribeCreateAccountStatusRequest = {
                    CreateAccountRequestId: createAccountsResponse.CreateAccountStatus.Id,
                };
                await sleep(1000);
                const response = await this.organizationService.describeCreateAccountStatus(describeAccountStatusReq).promise();
                accountCreationStatus = response.CreateAccountStatus;
            }

            const partitionCredentials = new Credentials(await AwsUtil.GetPartitionCredentials());

            if (partitionCredentials) {

                const inviteParams = {
                    Target: {
                        Id: accountCreationStatus.GovCloudAccountId,
                        Type: 'ACCOUNT',
                    },
                };

                await this.partitionOrgService.inviteAccountToOrganization(inviteParams).promise();

                const assumeParams = {
                    RoleArn: `arn:aws-us-gov:iam::${accountCreationStatus.GovCloudAccountId}:role/OrganizationAccountAccessRole`,
                    RoleSessionName: 'AssumeRoleSession',
                };

                const role = await this.partitionOrgSTS.assumeRole(assumeParams).promise();
                const partitionAccountOrgService = new Organizations({
                    credentials: {
                        accessKeyId: role.Credentials.AccessKeyId,
                        secretAccessKey: role.Credentials.SecretAccessKey,
                        sessionToken: role.Credentials.SessionToken,
                    },
                    region: AwsUtil.GetPartitionRegion(),
                }
                );

                const handshakeList = await partitionAccountOrgService.listHandshakesForAccount().promise();
                await partitionAccountOrgService.acceptHandshake({ HandshakeId: handshakeList.Handshakes[0].Id }).promise();


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
                SupportLevel: 'basic',
                PartitionId: accountCreationStatus.GovCloudAccountId,
            });

            return accountCreationStatus;
        });
    }

    private async _moveOuChildren(sourceId: string, targetId: string, mappedOUIds: Record<string, string>, onlyAccounts = false): Promise<void> {

        const listAccountsOfPreviousOURequest: ListAccountsForParentRequest = { ParentId: sourceId };
        let listAccountsOfPreviousOU: ListAccountsForParentResponse = {};
        do {
            listAccountsOfPreviousOU = await this.organizationService.listAccountsForParent(listAccountsOfPreviousOURequest).promise();
            for (const account of listAccountsOfPreviousOU.Accounts) {
                ConsoleUtil.LogDebug(`moving account ${account.Name} from ou ${sourceId} to ou ${targetId}`);
                await this.attachAccount(targetId, account.Id);
            }
            listAccountsOfPreviousOURequest.NextToken = listAccountsOfPreviousOURequest.NextToken;
        } while (listAccountsOfPreviousOU.NextToken);

        if (!onlyAccounts) {

            const listServiceControlPoliciesOfPreviousOURequest: ListPoliciesForTargetRequest = { TargetId: sourceId, Filter: 'SERVICE_CONTROL_POLICY' };
            let listServiceControlPoliciesOfPreviousOU: ListPoliciesForTargetResponse = {};
            do {
                listServiceControlPoliciesOfPreviousOU = await this.organizationService.listPoliciesForTarget(listServiceControlPoliciesOfPreviousOURequest).promise();
                for (const scp of listServiceControlPoliciesOfPreviousOU.Policies) {
                    ConsoleUtil.LogDebug(`moving scp from ou ${sourceId} to ou ${targetId}`);
                    const attachPromise = this.organizationService.attachPolicy({ PolicyId: scp.Id, TargetId: targetId });
                    const detachPromise = this.organizationService.detachPolicy({ PolicyId: scp.Id, TargetId: sourceId });
                    await Promise.all([attachPromise, detachPromise]);
                }
            } while (listServiceControlPoliciesOfPreviousOU.NextToken);

            const listChildUnitsOfPreviousOURequest: ListOrganizationalUnitsForParentRequest = { ParentId: sourceId };
            let childUnitsOfPreviousOU: ListOrganizationalUnitsForParentResponse = await this.organizationService.listOrganizationalUnitsForParent(listChildUnitsOfPreviousOURequest).promise();
            do {
                childUnitsOfPreviousOU = await this.organizationService.listOrganizationalUnitsForParent(listChildUnitsOfPreviousOURequest).promise();
                for (const child of childUnitsOfPreviousOU.OrganizationalUnits) {
                    ConsoleUtil.LogDebug(`moving child ou from ou ${sourceId} to ou ${targetId}`);
                    await this.moveOU(targetId, child.Id, mappedOUIds);
                }
            } while (childUnitsOfPreviousOU.NextToken);

        }

    }
}
