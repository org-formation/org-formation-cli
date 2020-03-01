import { CloudFormation, IAM, S3, STS, Support } from 'aws-sdk';
import { CredentialsOptions } from 'aws-sdk/lib/credentials';
import { PasswordPolicyResource } from '~parser/model/password-policy-resource';
import { Reference } from '~parser/model/resource';

export class AwsUtil {

    public static ClearCache(): void {
        AwsUtil.masterAccountId = undefined;
        AwsUtil.CfnServiceCache = {};
        AwsUtil.IamServiceCache = {};
        AwsUtil.SupportServiceCache = {};
    }

    public static async GetMasterAccountId(): Promise<string> {
        if (AwsUtil.masterAccountId !== undefined) {
            return AwsUtil.masterAccountId;
        }
        const stsClient = new STS();
        const caller = await stsClient.getCallerIdentity().promise();
        AwsUtil.masterAccountId = caller.Account;
        return AwsUtil.masterAccountId;
    }

    public static async GetSupportService(accountId: string): Promise<Support> {
        return await AwsUtil.getOrCreateService<Support>(Support, AwsUtil.SupportServiceCache, accountId, accountId, { region: 'us-east-1' });
    }

    public static async GetIamService(accountId: string): Promise<IAM> {
        return await AwsUtil.getOrCreateService<IAM>(IAM, AwsUtil.IamServiceCache, accountId, accountId, {});
    }

    public static async GetCloudFormation(accountId: string, region: string): Promise<CloudFormation> {
        return await AwsUtil.getOrCreateService<CloudFormation>(CloudFormation, AwsUtil.CfnServiceCache, accountId,  `${accountId}/${region}`, { region });
    }

    public static async DeleteObject(bucketName: string, objectKey: string): Promise<void> {
        const s3client = new S3();
        await s3client.deleteObject({Bucket: bucketName, Key: objectKey}).promise();
    }

    private static async getOrCreateService<TService>(ctr: new(args: CloudFormation.Types.ClientConfiguration) => TService, cache: Record<string, TService>, accountId: string, cacheKey: string = accountId, clientConfig: CloudFormation.Types.ClientConfiguration = {}): Promise<TService> {
        const cachedService = cache[cacheKey];
        if (cachedService) {
            return cachedService;
        }

        const config = clientConfig;
        const masterAccountId = await AwsUtil.GetMasterAccountId();
        if (accountId !== masterAccountId) {
            const credentialOptions: CredentialsOptions = await AwsUtil.getCredentials(accountId);
            config.credentials = credentialOptions;
        }

        const service = new ctr(config);

        cache[cacheKey] = service;
        return service;
    }

    private static async getCredentials(accountId: string): Promise<CredentialsOptions> {
        const sts = new STS();
        const roleArn = 'arn:aws:iam::' + accountId + ':role/OrganizationAccountAccessRole';
        const response = await sts.assumeRole({ RoleArn: roleArn, RoleSessionName: 'OrganizationFormationBuild' }).promise();
        const credentialOptions: CredentialsOptions = {
            accessKeyId: response.Credentials.AccessKeyId,
            secretAccessKey: response.Credentials.SecretAccessKey,
            sessionToken: response.Credentials.SessionToken,
        };
        return credentialOptions;
    }


    private static masterAccountId: string | PromiseLike<string>;
    private static IamServiceCache: Record<string, IAM> = {};
    private static SupportServiceCache: Record<string, Support> = {};
    private static CfnServiceCache: Record<string, CloudFormation> = {};
}

export const passwordPolicEquals = (passwordPolicy: IAM.PasswordPolicy, pwdPolicyResource: Reference<PasswordPolicyResource>): boolean => {

    if (!passwordPolicy && (!pwdPolicyResource || !pwdPolicyResource.TemplateResource)) {
        return true; // equal
    }
    if (!passwordPolicy) {
        return false;
    }

    if (!pwdPolicyResource || !pwdPolicyResource.TemplateResource) {
        return false;
    }

    if (passwordPolicy.AllowUsersToChangePassword !== pwdPolicyResource.TemplateResource.allowUsersToChangePassword) {
        return false;
    }

    if (passwordPolicy.MinimumPasswordLength !== pwdPolicyResource.TemplateResource.minimumPasswordLength) {
        return false;
    }

    if (passwordPolicy.RequireSymbols !== pwdPolicyResource.TemplateResource.requireSymbols) {
        return false;
    }

    if (passwordPolicy.RequireNumbers !== pwdPolicyResource.TemplateResource.requireNumbers) {
        return false;
    }

    if (passwordPolicy.RequireUppercaseCharacters !== pwdPolicyResource.TemplateResource.requireUppercaseCharacters) {
        return false;
    }

    if (passwordPolicy.RequireLowercaseCharacters !== pwdPolicyResource.TemplateResource.requireLowercaseCharacters) {
        return false;
    }

    if (passwordPolicy.MaxPasswordAge !== pwdPolicyResource.TemplateResource.maxPasswordAge) {
        return false;
    }

    if (passwordPolicy.PasswordReusePrevention !== pwdPolicyResource.TemplateResource.passwordReusePrevention) {
        return false;
    }

    return true;
};
