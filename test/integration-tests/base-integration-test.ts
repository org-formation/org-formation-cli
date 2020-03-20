import AWS, { SharedIniFileCredentials, S3, EnvironmentCredentials } from "aws-sdk";
import { v4 } from "uuid";
import { AwsUtil } from "../../src/aws-util";
import { ConsoleUtil } from "../../src/console-util";

export const profileForIntegrationTests = 'org-formation-test-v2'

export const baseBeforeAll = async (): Promise<IIntegrationTestContext> => {
    jest.setTimeout(99999999);

    ConsoleUtil.verbose = true;
    ConsoleUtil.printStacktraces = true;

    await AwsUtil.Initialize([
        () => new EnvironmentCredentials('TST_AWS'),
        () => new SharedIniFileCredentials({ profile: profileForIntegrationTests }),
    ]);

    return {
        stateBucketName: `${v4()}`,
        stackName: `a${Math.floor(Math.random() * 10000)}`,
        s3client: new S3({credentialProvider: AWS.config.credentialProvider}),
    }
}


export const baseAfterAll = async(context: IIntegrationTestContext): Promise<void> => {
    const response = await context.s3client.listObjects({ Bucket: context.stateBucketName }).promise();
    const objectIdentifiers = response.Contents.map((x) => ({ Key: x.Key }));
    await context.s3client.deleteObjects({ Bucket:  context.stateBucketName, Delete: { Objects: objectIdentifiers } }).promise();
    await context.s3client.deleteBucket({ Bucket:  context.stateBucketName }).promise();
}



export interface IIntegrationTestContext {
    stateBucketName: string;
    stackName: string;
    s3client: S3;
}