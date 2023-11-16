import { v4 } from "uuid";
import { AwsUtil } from "~util/aws-util";
import { ConsoleUtil } from "~util/console-util";
import { IPerformTasksCommandArgs, IUpdateStacksCommandArgs } from "~commands/index";
import { readFileSync } from "fs";
import { GenericTaskRunner } from "~core/generic-task-runner";
import { fromCustomEnv } from "~util/credentials-provider-custom-env";
import { fromIni } from "@aws-sdk/credential-providers";
import { chain } from "@smithy/property-provider";
import { CreateBucketCommand, DeleteBucketCommand, DeleteObjectsCommand, ListObjectsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { CloudFormationClient, ListStacksCommand } from "@aws-sdk/client-cloudformation";
import { GlobalState } from "~util/global-state";

export const profileForIntegrationTests = 'org-formation-test-v2';

export const baseBeforeAll = async (profileName: string = profileForIntegrationTests, environmentCredentials = 'TST_AWS'): Promise<IIntegrationTestContext> => {
    jest.setTimeout(99999999);

    AwsUtil.SetMasterAccountId(undefined);
    GenericTaskRunner.RethrowTaskErrors = true;
    ConsoleUtil.verbose = false;
    ConsoleUtil.printStacktraces = true;
    Error.stackTraceLimit = 50;
    process.on('unhandledRejection', error => {
        // Will print "unhandledRejection err is not defined"
        expect(`${error}`).toBeUndefined();
    });

    // const logDebugMock = jest.spyOn(ConsoleUtil, 'LogDebug').mockImplementation();
    const logInfoMock = jest.spyOn(ConsoleUtil, 'LogInfo').mockImplementation();
    const logWarningMock = jest.spyOn(ConsoleUtil, 'LogWarning').mockImplementation();

    // this tests get their credentials from either prefixed environment variables or from a profile with a specific name
    const credentialsChain = chain(fromCustomEnv(environmentCredentials), fromIni({ profile: profileName }));

    await AwsUtil.Initialize(credentialsChain);
    await AwsUtil.SetEnabledRegions();

    const stateBucketName = `${v4()}`;
    const stackName = `a${Math.floor(Math.random() * 10000)}`;
    const command = { stateBucketName, stateObject: 'state.json', logicalName: 'default', stackName, profile: profileForIntegrationTests, verbose: true, maxConcurrentStacks: 10, failedStacksTolerance: 0, maxConcurrentTasks: 10, failedTasksTolerance: 0 } as any;

    const s3ClientThatDoesntAssumeRole = new S3Client({ credentials: credentialsChain, region: 'eu-west-1' });
    const cfnClientThatDoesntAssumeRole = new CloudFormationClient({ credentials: credentialsChain, region: 'eu-west-1' })

    return {
        logDebugMock: {} as any,
        logInfoMock,
        logWarningMock,
        stateBucketName,
        stackName,
        command,
        s3client: s3ClientThatDoesntAssumeRole,
        cfnClient: cfnClientThatDoesntAssumeRole,
        prepareStateBucket: async (stateFilePath: string): Promise<void> => {
            await s3ClientThatDoesntAssumeRole.send(new CreateBucketCommand({ Bucket: stateBucketName }));
            await sleepForTest(200);
            await s3ClientThatDoesntAssumeRole.send(new PutObjectCommand({ Bucket: command.stateBucketName, Key: command.stateObject, Body: readFileSync(stateFilePath) }));
        }
    };
};


export const baseAfterAll = async (context: IIntegrationTestContext): Promise<void> => {
    const response = await context.s3client.send(new ListObjectsCommand({ Bucket: context.stateBucketName }));
    const objectIdentifiers = response.Contents.map((x) => ({ Key: x.Key }));
    await context.s3client.send(new DeleteObjectsCommand({ Bucket: context.stateBucketName, Delete: { Objects: objectIdentifiers } }));
    await context.s3client.send(new DeleteBucketCommand({ Bucket: context.stateBucketName }));
};


export const sleepForTest = (time: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, time));
};


export interface IIntegrationTestContext {
    logDebugMock: jest.SpyInstance;
    logInfoMock: jest.SpyInstance;
    logWarningMock: jest.SpyInstance;
    stateBucketName: string;
    stackName: string;
    s3client: S3Client;
    cfnClient: CloudFormationClient;
    command: IPerformTasksCommandArgs & IUpdateStacksCommandArgs;
    prepareStateBucket: (stateFilePath: string) => Promise<void>;
}