import AWS, { SharedIniFileCredentials, S3, EnvironmentCredentials, CloudFormation } from "aws-sdk";
import { v4 } from "uuid";
import { AwsUtil } from "~util/aws-util";
import { ConsoleUtil } from "~util/console-util";
import { IPerformTasksCommandArgs, IDescribeStackCommandArgs, IUpdateStacksCommandArgs } from "~commands/index";
import { readFileSync } from "fs";

export const profileForIntegrationTests = 'org-formation-test-v2'

export const baseBeforeAll = async (profileName: string = profileForIntegrationTests): Promise<IIntegrationTestContext> => {
    jest.setTimeout(99999999);

    AwsUtil.SetMasterAccountId(undefined);

    ConsoleUtil.verbose = true;
    ConsoleUtil.printStacktraces = true;
    process.on('unhandledRejection', error => {
        // Will print "unhandledRejection err is not defined"
        expect(`${error}`).toBeUndefined();
      });

    //const logDebugMock = jest.spyOn(ConsoleUtil, 'LogDebug').mockImplementation();
    const logInfoMock = jest.spyOn(ConsoleUtil, 'LogInfo').mockImplementation();
    const logWarningMock = jest.spyOn(ConsoleUtil, 'LogWarning').mockImplementation();

    await AwsUtil.Initialize([
        () => new EnvironmentCredentials('TST_AWS'),
        () => new SharedIniFileCredentials({ profile: profileName }),
    ]);

    const stateBucketName = `${v4()}`;
    const stackName = `a${Math.floor(Math.random() * 10000)}`;
    const command = {stateBucketName: stateBucketName, stateObject: 'state.json', logicalName: 'default', stackName: stackName, profile: profileForIntegrationTests, verbose: true, maxConcurrentStacks: 10, failedStacksTolerance: 0, maxConcurrentTasks: 10, failedTasksTolerance: 0 } as any;
    const s3client = new S3({credentialProvider: AWS.config.credentialProvider});

    return {
        logDebugMock: {} as any,
        logInfoMock,
        logWarningMock,
        stateBucketName,
        stackName,
        command,
        s3client,
        cfnClient: new CloudFormation({credentialProvider: AWS.config.credentialProvider, region: 'eu-west-1'}),
        prepareStateBucket: async (stateFilePath: string) : Promise<void> => {
            await s3client.createBucket({ Bucket: stateBucketName }).promise();
            await sleepForTest(200);
            await s3client.upload({ Bucket: command.stateBucketName, Key: command.stateObject, Body: readFileSync(stateFilePath) }).promise();
        }
    }
}


export const baseAfterAll = async(context: IIntegrationTestContext): Promise<void> => {
    const response = await context.s3client.listObjects({ Bucket: context.stateBucketName }).promise();
    const objectIdentifiers = response.Contents.map((x) => ({ Key: x.Key }));
    await context.s3client.deleteObjects({ Bucket:  context.stateBucketName, Delete: { Objects: objectIdentifiers } }).promise();
    await context.s3client.deleteBucket({ Bucket:  context.stateBucketName }).promise();
}


export const sleepForTest = (time: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, time));
};


export interface IIntegrationTestContext {
    logDebugMock: jest.SpyInstance;
    logInfoMock: jest.SpyInstance;
    logWarningMock: jest.SpyInstance;
    stateBucketName: string;
    stackName: string;
    s3client: S3;
    cfnClient: CloudFormation;
    command: IPerformTasksCommandArgs & IUpdateStacksCommandArgs ;
    prepareStateBucket: (stateFilePath: string) => Promise<void>
}