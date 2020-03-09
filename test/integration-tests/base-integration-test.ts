import { SharedIniFileCredentials, S3, Organizations } from "aws-sdk";
import { v4 } from "uuid";
import { AwsUtil } from "../../src/aws-util";
import { ConsoleUtil } from "../../src/console-util";

export const profileForTests = 'org-formation-test-v2'

export const baseBeforeAll = async (): Promise<IIntegrationTestContext> => {
    jest.setTimeout(99999999);

    ConsoleUtil.verbose = true;
    ConsoleUtil.printStacktraces = true;

    await AwsUtil.InitializeWithProfile(profileForTests);
    const creds = new SharedIniFileCredentials({ profile: profileForTests });

    return {
        stateBucketName: `${v4()}`,
        stackName: `a${Math.floor(Math.random() * 10000)}`,
        creds,
        s3client: new S3({ credentials: creds }),
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
    creds: SharedIniFileCredentials;
    s3client: S3;
}