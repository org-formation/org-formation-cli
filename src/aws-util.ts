import { CloudFormation, IAM, S3, STS } from 'aws-sdk/clients/all';
import { CredentialsOptions } from 'aws-sdk/lib/credentials';
import { PasswordPolicyResource } from './parser/model/password-policy-resource';
import { Reference } from './parser/model/resource';

export class AwsUtil {

    public static ClearCache() {
        AwsUtil.masterAccountId = undefined;
        AwsUtil.CfnServiceCache = {};
        AwsUtil.IamServiceCache = {};
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

    public static async GetIamService(accountId: string): Promise<IAM> {

        const cachedIam = AwsUtil.IamServiceCache[accountId];
        if (cachedIam) {
            return cachedIam;
        }

        const masterAccountId = await AwsUtil.GetMasterAccountId();
        if (masterAccountId === accountId) {
            const masterIam  =  new IAM();
            AwsUtil.IamServiceCache[accountId] = masterIam;
            return masterIam;
        }

        const sts = new STS();
        const roleArn = 'arn:aws:iam::' + accountId + ':role/OrganizationAccountAccessRole';
        const response = await sts.assumeRole({ RoleArn: roleArn, RoleSessionName: 'OrganizationFormationBuild' }).promise();

        const credentialOptions: CredentialsOptions = {
            accessKeyId: response.Credentials.AccessKeyId,
            secretAccessKey: response.Credentials.SecretAccessKey,
            sessionToken: response.Credentials.SessionToken,
        };

        const iam = new IAM({ credentials: credentialOptions });
        AwsUtil.IamServiceCache[accountId] = iam;
        return iam;
    }

    public static async GetCloudFormation(accountId: string, region: string): Promise<CloudFormation> {
        const cacheKey = `${accountId}/${region}`;
        const cachedCfn = AwsUtil.CfnServiceCache[cacheKey];
        if (cachedCfn) {
            return cachedCfn;
        }

        let cfn;
        const masterAccountId = await AwsUtil.GetMasterAccountId();
        if (accountId !== masterAccountId) {
            const sts = new STS();
            const roleArn = 'arn:aws:iam::' + accountId + ':role/OrganizationAccountAccessRole';
            const response = await sts.assumeRole({ RoleArn: roleArn, RoleSessionName: 'OrganizationFormationBuild' }).promise();

            const credentialOptions: CredentialsOptions = {
                accessKeyId: response.Credentials.AccessKeyId,
                secretAccessKey: response.Credentials.SecretAccessKey,
                sessionToken: response.Credentials.SessionToken,
            };

            cfn = new CloudFormation({ credentials: credentialOptions, region });
        } else {
            cfn = new CloudFormation({ region });
        }

        AwsUtil.CfnServiceCache[cacheKey] = cfn;
        return cfn;
    }
    public static async DeleteObject(bucketName: string, objectKey: string) {
        const s3client = new S3();
        await s3client.deleteObject({Bucket: bucketName, Key: objectKey}).promise();
    }
    private static masterAccountId: string | PromiseLike<string>;
    private static IamServiceCache: Record<string, IAM> = {};
    private static CfnServiceCache: Record<string, CloudFormation> = {};
}

export function passwordPolicEquals(passwordPolicy: IAM.PasswordPolicy, pwdPolicyResource: Reference<PasswordPolicyResource>): boolean {

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
}
