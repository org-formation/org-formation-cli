import { IAM, Organizations, STS } from 'aws-sdk/clients/all';
import { CredentialsOptions } from 'aws-sdk/lib/credentials';
import { PasswordPolicyResource } from './parser/model/password-policy-resource';
import { Reference } from './parser/model/resource';

export class AwsUtil {
    public static async GetIamService(org: Organizations.Organization, accountId: string) {
        if (org.MasterAccountId === accountId) {
            return new IAM();
        }

        const cachedIam = AwsUtil.IamServiceCache[accountId];
        if (cachedIam) {
            return cachedIam;
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
    private static IamServiceCache: Record<string, IAM> = {};
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
