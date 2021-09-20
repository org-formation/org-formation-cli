import { readFileSync } from 'fs';
// import { inspect } from 'util'; // or directly
import { CloudFormation, IAM, S3, STS, Support, CredentialProviderChain, Organizations } from 'aws-sdk';
import { CredentialsOptions } from 'aws-sdk/lib/credentials';
import AWS from 'aws-sdk';
import { SingleSignOnCredentials } from '@mhlabs/aws-sdk-sso';
import { provider } from 'aws-sdk/lib/credentials/credential_provider_chain';
import { ListExportsInput, UpdateStackInput, DescribeStacksOutput, CreateStackInput, ValidateTemplateInput } from 'aws-sdk/clients/cloudformation';
import { DescribeOrganizationResponse } from 'aws-sdk/clients/organizations';
import { PutObjectRequest } from 'aws-sdk/clients/s3';
import { ServiceConfigurationOptions } from 'aws-sdk/lib/service';
import * as ini from 'ini';
import { v4 as uuid } from 'uuid';
import { OrgFormationError } from '../org-formation-error';
import { ConsoleUtil } from './console-util';
import { GlobalState } from './global-state';
import { PasswordPolicyResource, Reference } from '~parser/model';
import { ICfnBinding } from '~cfn-binder/cfn-binder';

type CredentialProviderOptions = ConstructorParameters<typeof AWS.SharedIniFileCredentials>[0];

export const DEFAULT_ROLE_FOR_ORG_ACCESS = { RoleName: 'OrganizationAccountAccessRole' };
export const DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS = { RoleName: 'OrganizationAccountAccessRole' };


export class AwsUtil {

    public static ClearCache(): void {
        AwsUtil.masterAccountId = undefined;
        AwsUtil.CfnServiceCache = {};
        AwsUtil.IamServiceCache = {};
        AwsUtil.SupportServiceCache = {};
        AwsUtil.S3ServiceCache = {};
    }

    private static organization: DescribeOrganizationResponse;
    public static async GetPrincipalOrgId(): Promise<string> {
        if (this.organization !== undefined) {
            return this.organization.Organization.Id;
        }

        const organizationService = new Organizations({ region: 'us-east-1' });
        this.organization = await organizationService.describeOrganization().promise();
        return this.organization.Organization.Id;

    }

    public static async InitializeWithProfile(profile?: string): Promise<AWS.Credentials> {
        if (profile) {
            process.env.AWS_SDK_LOAD_CONFIG = '1';
            const params: CredentialProviderOptions = { profile };
            if (process.env.AWS_SHARED_CREDENTIALS_FILE) {
                params.filename = process.env.AWS_SHARED_CREDENTIALS_FILE;
            }

            // Setup a MFA callback to ask the code from user
            params.tokenCodeFn = async (mfaSerial: string, callback: any): Promise<void> => {
                const token = await ConsoleUtil.Readline(`👋 Enter MFA code for ${mfaSerial}`);
                callback(null, token);
            };

            return await this.Initialize([
                (): AWS.Credentials => new AWS.SharedIniFileCredentials(params),
                (): AWS.Credentials => new SingleSignOnCredentials(params),
                (): AWS.Credentials => new AWS.ProcessCredentials(params),
            ]);
        }
        const defaultProviders = CredentialProviderChain.defaultProviders;
        // We will place SSO credentials provider right after ProcessCredentials in the priority list.
        // https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/setting-credentials-node.html
        defaultProviders.splice(5, 0, (): AWS.Credentials => new SingleSignOnCredentials());
        return await this.Initialize(defaultProviders);
    }

    public static async Initialize(providers: provider[]): Promise<AWS.Credentials> {
        const chainProvider = new CredentialProviderChain(providers);
        return AWS.config.credentials = await chainProvider.resolvePromise();
    }

    public static SetMasterAccountId(masterAccountId: string): void {
        AwsUtil.masterAccountId = masterAccountId;
    }

    static SetBuildAccountId(buildAccountId: string): void {
        AwsUtil.buildProcessAccountId = buildAccountId;
    }

    public static async GetMasterAccountId(): Promise<string> {
        if (AwsUtil.masterAccountId !== undefined) {
            return AwsUtil.masterAccountId;
        }
        const stsClient = new STS(); // if not set, assume build process runs in master
        const caller = await stsClient.getCallerIdentity().promise();
        if (caller.Arn) {
            const partition = caller.Arn.match(/arn\:([^:]*)\:/)[1];
            AwsUtil.partition = partition;
        }
        AwsUtil.masterAccountId = caller.Account;
        return AwsUtil.masterAccountId;
    }

    public static async InitializeWithCurrentPartition(): Promise<string> {
        if (AwsUtil.partition) {
            return AwsUtil.partition;
        }
        const stsClient = new STS();
        const caller = await stsClient.getCallerIdentity().promise();
        const partition = caller.Arn.match(/arn\:([^:]*)\:/)[1];
        AwsUtil.partition = partition;
        return partition;
    }

    public static async GetBuildProcessAccountId(): Promise<string> {
        if (AwsUtil.buildProcessAccountId !== undefined) {
            return AwsUtil.buildProcessAccountId;
        }
        const stsClient = new STS();
        const caller = await stsClient.getCallerIdentity().promise();
        AwsUtil.buildProcessAccountId = caller.Account;
        return AwsUtil.buildProcessAccountId;
    }

    public static async GetBuildRunningOnMasterAccount(): Promise<boolean> {
        return (await this.GetMasterAccountId()) === (await this.GetBuildProcessAccountId());
    }


    public static async GetOrganizationsService(accountId: string, roleInTargetAccount: string): Promise<Organizations> {
        return await AwsUtil.GetOrCreateService<Organizations>(Organizations, AwsUtil.OrganizationsServiceCache, accountId, `${accountId}/${roleInTargetAccount}`, { region: 'us-east-1' }, roleInTargetAccount);
    }

    public static async GetSupportService(accountId: string, roleInTargetAccount: string, viaRoleArn?: string): Promise<Support> {
        return await AwsUtil.GetOrCreateService<Support>(Support, AwsUtil.SupportServiceCache, accountId, `${accountId}/${roleInTargetAccount}/${viaRoleArn}`, { region: 'us-east-1' }, roleInTargetAccount, viaRoleArn);
    }

    public static GetRoleArn(accountId: string, roleInTargetAccount: string): string {
        return 'arn:aws:iam::' + accountId + ':role/' + roleInTargetAccount;
    }

    public static async GetS3Service(accountId: string, region?: string, roleInTargetAccount?: string): Promise<S3> {
        const config: ServiceConfigurationOptions = {};
        if (region !== undefined) {
            config.region = region;
        }

        return await AwsUtil.GetOrCreateService<S3>(S3, AwsUtil.S3ServiceCache, accountId, `${accountId}/${roleInTargetAccount}`, config, roleInTargetAccount);

    }

    public static async GetIamService(accountId: string, roleInTargetAccount?: string, viaRoleArn?: string): Promise<IAM> {
        return await AwsUtil.GetOrCreateService<IAM>(IAM, AwsUtil.IamServiceCache, accountId, `${accountId}/${roleInTargetAccount}/${viaRoleArn}`, {}, roleInTargetAccount, viaRoleArn);
    }

    public static async GetCloudFormation(accountId: string, region: string, roleInTargetAccount?: string, viaRoleArn?: string): Promise<CloudFormation> {
        return await AwsUtil.GetOrCreateService<CloudFormation>(CloudFormation, AwsUtil.CfnServiceCache, accountId, `${accountId}/${region}/${roleInTargetAccount}/${roleInTargetAccount}/${viaRoleArn}`, { region }, roleInTargetAccount, viaRoleArn);
    }

    public static async DeleteObject(bucketName: string, objectKey: string, credentials: CredentialsOptions = undefined): Promise<void> {
        const s3client = new S3({ credentials });
        await s3client.deleteObject({ Bucket: bucketName, Key: objectKey }).promise();
    }

    private static async GetOrCreateService<TService>(ctr: new (args: CloudFormation.Types.ClientConfiguration) => TService, cache: Record<string, TService>, accountId: string, cacheKey: string = accountId, clientConfig: ServiceConfigurationOptions = {}, roleInTargetAccount: string, viaRoleArn?: string): Promise<TService> {
        const cachedService = cache[cacheKey];
        if (cachedService) {
            return cachedService;
        }

        const config = clientConfig;


        if (typeof roleInTargetAccount !== 'string') {
            roleInTargetAccount = GlobalState.GetCrossAccountRoleName(accountId);
        }

        const credentialOptions: CredentialsOptions = await AwsUtil.GetCredentials(accountId, roleInTargetAccount, viaRoleArn);
        if (credentialOptions !== undefined) {
            config.credentials = credentialOptions;
        }

        const service = new ctr(config);

        cache[cacheKey] = service;
        return service;
    }

    public static async GetCredentials(accountId: string, roleInTargetAccount: string, viaRoleArn?: string): Promise<CredentialsOptions | undefined> {

        const masterAccountId = await AwsUtil.GetMasterAccountId();
        const useCurrentPrincipal = (masterAccountId === accountId && roleInTargetAccount === GlobalState.GetOrganizationAccessRoleName(accountId));
        if (useCurrentPrincipal) {
            return undefined;
        }

        try {
            const roleArn = AwsUtil.GetRoleArn(accountId, roleInTargetAccount);
            const config: STS.ClientConfiguration = {};
            if (viaRoleArn !== undefined) {
                config.credentials = await AwsUtil.GetCredentialsForRole(viaRoleArn, {});
            }
            return await AwsUtil.GetCredentialsForRole(roleArn, config);
        } catch (err) {
            const buildAccountId = await AwsUtil.GetBuildProcessAccountId();
            if (accountId === buildAccountId) {
                ConsoleUtil.LogWarning('======================================');
                ConsoleUtil.LogWarning('Hi there!');
                ConsoleUtil.LogWarning(`You just ran into an error when assuming the role ${roleInTargetAccount} in account ${buildAccountId}.`);
                ConsoleUtil.LogWarning('Possibly, this is due a breaking change in org-formation v0.9.15.');
                ConsoleUtil.LogWarning('From v0.9.15 onwards the org-formation cli will assume a role in every account it deploys tasks to.');
                ConsoleUtil.LogWarning('This will make permission management and SCPs to deny / allow org-formation tasks easier.');
                ConsoleUtil.LogWarning('More information: https://github.com/org-formation/org-formation-cli/tree/master/docs/0.9.15-permission-change.md');
                ConsoleUtil.LogWarning('Thanks!');
                ConsoleUtil.LogWarning('======================================');
            }
            throw err;
        }
    }

    private static async GetCredentialsForRole(roleArn: string, config: STS.ClientConfiguration): Promise<CredentialsOptions> {
        const sts = new STS(config);

        const response = await sts.assumeRole({ RoleArn: roleArn, RoleSessionName: 'OrganizationFormationBuild' }).promise();
        const credentialOptions: CredentialsOptions = {
            accessKeyId: response.Credentials.AccessKeyId,
            secretAccessKey: response.Credentials.SecretAccessKey,
            sessionToken: response.Credentials.SessionToken,
        };
        return credentialOptions;

    }

    public static async GetCloudFormationExport(exportName: string, accountId: string, region: string, customRoleName: string, customViaRoleArn?: string): Promise<string | undefined> {
        const cfnRetrieveExport = await AwsUtil.GetCloudFormation(accountId, region, customRoleName, customViaRoleArn);
        const listExportsRequest: ListExportsInput = {};
        do {
            const listExportsResponse = await cfnRetrieveExport.listExports(listExportsRequest).promise();
            listExportsRequest.NextToken = listExportsResponse.NextToken;
            const foundExport = listExportsResponse.Exports.find(x => x.Name === exportName);
            if (foundExport) {
                return foundExport.Value;
            }
        } while (listExportsRequest.NextToken);
        return undefined;
    }

    public static GetDefaultRegion(profileName?: string): string {
        const defaultRegionFromEnv = process.env.AWS_DEFAULT_REGION;
        if (defaultRegionFromEnv) { return defaultRegionFromEnv; }

        const homeDir = require('os').homedir();
        const config = readFileSync(homeDir + '/.aws/config').toString('utf8');
        const contents = ini.parse(config);
        const profileKey = profileName ?
            contents[profileName] ?? contents['profile ' + profileName] :
            contents.default;

        if (profileKey.region) {
            return profileKey.region;
        }

        const regionFromEnv = process.env.AWS_REGION;
        if (regionFromEnv) { return regionFromEnv; }

        return 'us-east-1';
    }

    public static partition: string;
    private static masterAccountId: string | PromiseLike<string>;
    private static buildProcessAccountId: string | PromiseLike<string>;
    private static IamServiceCache: Record<string, IAM> = {};
    private static SupportServiceCache: Record<string, Support> = {};
    private static OrganizationsServiceCache: Record<string, Organizations> = {};
    private static CfnServiceCache: Record<string, CloudFormation> = {};
    private static S3ServiceCache: Record<string, S3> = {};
}

export const passwordPolicyEquals = (pwdPolicyResourceA: Reference<PasswordPolicyResource>, pwdPolicyResourceB: Reference<PasswordPolicyResource>): boolean => {

    if (pwdPolicyResourceA?.TemplateResource === pwdPolicyResourceB?.TemplateResource) {
        return true; // equal
    }
    if (!pwdPolicyResourceA?.TemplateResource) {
        return false;
    }
    if (!pwdPolicyResourceB?.TemplateResource) {
        return false;
    }

    if (pwdPolicyResourceA.TemplateResource.allowUsersToChangePassword !== pwdPolicyResourceB.TemplateResource.allowUsersToChangePassword) {
        return false;
    }

    if (pwdPolicyResourceA.TemplateResource.minimumPasswordLength !== pwdPolicyResourceB.TemplateResource.minimumPasswordLength) {
        return false;
    }

    if (pwdPolicyResourceA.TemplateResource.requireSymbols !== pwdPolicyResourceB.TemplateResource.requireSymbols) {
        return false;
    }

    if (pwdPolicyResourceA.TemplateResource.requireNumbers !== pwdPolicyResourceB.TemplateResource.requireNumbers) {
        return false;
    }

    if (pwdPolicyResourceA.TemplateResource.requireUppercaseCharacters !== pwdPolicyResourceB.TemplateResource.requireUppercaseCharacters) {
        return false;
    }

    if (pwdPolicyResourceA.TemplateResource.requireLowercaseCharacters !== pwdPolicyResourceB.TemplateResource.requireLowercaseCharacters) {
        return false;
    }

    if (pwdPolicyResourceA.TemplateResource.maxPasswordAge !== pwdPolicyResourceB.TemplateResource.maxPasswordAge) {
        return false;
    }

    if (pwdPolicyResourceA.TemplateResource.passwordReusePrevention !== pwdPolicyResourceB.TemplateResource.passwordReusePrevention) {
        return false;
    }

    return true;
};

export class CfnUtil {

    public static async UploadTemplateToS3IfTooLarge(stackInput: CreateStackInput | UpdateStackInput | ValidateTemplateInput, binding: ICfnBinding, stackName: string, templateHash: string): Promise<void> {
        if (stackInput.TemplateBody && stackInput.TemplateBody.length > 50000) {
            const s3Service = await AwsUtil.GetS3Service(binding.accountId, binding.region);
            const bucketName = `org-formation-${binding.accountId}-${binding.region}-large-templates`;
            try {
                await s3Service.createBucket({ Bucket: bucketName }).promise();
                await s3Service.putBucketOwnershipControls({ Bucket: bucketName, OwnershipControls: { Rules: [{ ObjectOwnership: 'BucketOwnerPreferred' }] } }).promise();
                await s3Service.putPublicAccessBlock({
                    Bucket: bucketName,
                    PublicAccessBlockConfiguration: {
                        BlockPublicAcls: true,
                        IgnorePublicAcls: true,
                        BlockPublicPolicy: true,
                        RestrictPublicBuckets: true,
                    },
                }).promise();
                await s3Service.putBucketEncryption({
                    Bucket: bucketName, ServerSideEncryptionConfiguration: {
                        Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } }],
                    },
                }).promise();
            } catch (err) {
                if (err && err.code !== 'BucketAlreadyOwnedByYou') {
                    throw new OrgFormationError(`unable to create bucket ${bucketName} in account ${binding.accountId}, error: ${err}`);
                }
            }

            const putObjetRequest: PutObjectRequest = { Bucket: bucketName, Key: `${stackName}-${templateHash}.json`, Body: stackInput.TemplateBody, ACL: 'bucket-owner-full-control' };
            await s3Service.putObject(putObjetRequest).promise();
            stackInput.TemplateURL = `https://${bucketName}.s3.amazonaws.com/${putObjetRequest.Key}`;
            delete stackInput.TemplateBody;
        }
    }


    public static async UpdateOrCreateStack(cfn: CloudFormation, updateStackInput: UpdateStackInput): Promise<DescribeStacksOutput> {
        let describeStack: DescribeStacksOutput;
        let retryStackIsBeingUpdated = false;
        let retryStackIsBeingUpdatedCount = 0;
        let retryAccountIsBeingInitialized = false;
        let retryAccountIsBeingInitializedCount = 0;

        do {
            retryStackIsBeingUpdated = false;
            retryAccountIsBeingInitialized = false;
            try {
                try {
                    updateStackInput.ClientRequestToken = uuid();
                    await cfn.updateStack(updateStackInput).promise();
                    describeStack = await cfn.waitFor('stackUpdateComplete', { StackName: updateStackInput.StackName, $waiter: { delay: 1, maxAttempts: 60 * 30 } }).promise();
                } catch (innerErr) {
                    if (innerErr && innerErr.code === 'ValidationError' && innerErr.message && innerErr.message.indexOf('does not exist') !== -1) {
                        updateStackInput.ClientRequestToken = uuid();
                        await cfn.createStack(updateStackInput).promise();
                        describeStack = await cfn.waitFor('stackCreateComplete', { StackName: updateStackInput.StackName, $waiter: { delay: 1, maxAttempts: 60 * 30 } }).promise();
                    } else {
                        throw innerErr;
                    }
                }
            } catch (err) {
                // ConsoleUtil.LogError(`ADDITIONAL ${updateStackInput.StackName}: ${inspect(err)}`);
                if (err && (err.code === 'OptInRequired' || err.code === 'InvalidClientTokenId')) {
                    if (retryAccountIsBeingInitializedCount >= 20) { // 20 * 30 sec = 10 minutes
                        throw new OrgFormationError('Account seems stuck initializing.');
                    }
                    retryAccountIsBeingInitializedCount += 1;
                    await sleep(26 + (4 * Math.random()));
                    retryAccountIsBeingInitialized = true;
                } else if (err && (err.code === 'ValidationError' && err.message) || (err.code === 'ResourceNotReady')) {
                    const message = err.message as string;
                    if (-1 !== message.indexOf('ROLLBACK_COMPLETE') || -1 !== message.indexOf('ROLLBACK_FAILED') || -1 !== message.indexOf('DELETE_FAILED')) {
                        await cfn.deleteStack({ StackName: updateStackInput.StackName, RoleARN: updateStackInput.RoleARN }).promise();
                        await cfn.waitFor('stackDeleteComplete', { StackName: updateStackInput.StackName, $waiter: { delay: 1, maxAttempts: 60 * 30 } }).promise();
                        updateStackInput.ClientRequestToken = uuid();
                        await cfn.createStack(updateStackInput).promise();
                        describeStack = await cfn.waitFor('stackCreateComplete', { StackName: updateStackInput.StackName, $waiter: { delay: 1, maxAttempts: 60 * 30 } }).promise();
                    } else if (-1 !== message.indexOf('No updates are to be performed.')) {
                        describeStack = await cfn.describeStacks({ StackName: updateStackInput.StackName }).promise();
                        // ignore;
                    } else if (
                        (-1 !== message.indexOf('is in UPDATE_ROLLBACK_IN_PROGRESS state and can not be updated.')) ||
                        (-1 !== message.indexOf('is in UPDATE_COMPLETE_CLEANUP_IN_PROGRESS state and can not be updated.')) ||
                        (-1 !== message.indexOf('is in UPDATE_IN_PROGRESS state and can not be updated.')) ||
                        (-1 !== message.indexOf('is in CREATE_ROLLBACK_IN_PROGRESS state and can not be updated.')) ||
                        (-1 !== message.indexOf('is in CREATE_COMPLETE_CLEANUP_IN_PROGRESS state and can not be updated.')) ||
                        (-1 !== message.indexOf('is in CREATE_IN_PROGRESS state and can not be updated.')) ||
                        (err.code === 'ResourceNotReady' && err.originalError?.code === 'Throttling')) {
                        if (retryStackIsBeingUpdatedCount >= 20) { // 20 * 30 sec = 10 minutes
                            throw new OrgFormationError(`Stack ${updateStackInput.StackName} seems stuck in UPDATE_IN_PROGRESS (or similar) state.`);
                        }

                        ConsoleUtil.LogInfo(`Stack ${updateStackInput.StackName} is already being updated. waiting.... `);
                        retryStackIsBeingUpdatedCount += 1;
                        await sleep(26 + (4 * Math.random()));
                        retryStackIsBeingUpdated = true;

                    } else {
                        throw err;
                    }
                } else {
                    throw err;
                }
            }
        } while (retryStackIsBeingUpdated || retryAccountIsBeingInitialized);
        return describeStack;
    }
}

const sleep = (seconds: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, 1000 * seconds));
};
