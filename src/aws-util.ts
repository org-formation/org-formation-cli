import { IAM, Organizations, STS } from 'aws-sdk/clients/all';
import { CredentialsOptions } from 'aws-sdk/lib/credentials';
import { AwsOrganization } from './aws-provider/aws-organization';

export class AwsUtil {
    public static async GetIamService(org: Organizations.Organization, accountId: string) {
        if (org.MasterAccountId === accountId) {
            return new IAM();
        }
        const sts = new STS();
        const roleArn = 'arn:aws:iam::' + accountId + ':role/OrganizationAccountAccessRole';
        const response = await sts.assumeRole({ RoleArn: roleArn, RoleSessionName: 'OrganizationFormationBuild' }).promise();

        const credentialOptions: CredentialsOptions = {
            accessKeyId: response.Credentials.AccessKeyId,
            secretAccessKey: response.Credentials.SecretAccessKey,
            sessionToken: response.Credentials.SessionToken,
        };

        return new IAM({ credentials: credentialOptions });
    }
}
