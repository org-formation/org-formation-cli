import { CloudFormation } from "aws-sdk";
import { PerformTasksCommand } from "~commands/index";
import { readFileSync } from "fs";
import { IIntegrationTestContext, baseBeforeAll, profileForIntegrationTests, baseAfterAll } from "./base-integration-test";
import { ListStacksOutput, ListStacksInput } from "aws-sdk/clients/cloudformation";

const basePathForScenario = './test/integration-tests/resources/scenario-cleanup-stacks/';


describe('when cleaning up stacks', () => {
    let context: IIntegrationTestContext;
    let cfnClient: CloudFormation;

    let stacksBeforeAll: ListStacksOutput;
    let stacksAfterAddBucket: ListStacksOutput;
    let stacksAfterRenoveBucketNoCleanup: ListStacksOutput;
    let stacksAfterAddBucket2: ListStacksOutput;
    let stacksAfterRemoveBucketWithCleanup: ListStacksOutput;

    beforeAll(async () => {
        context = await baseBeforeAll();
        cfnClient = new CloudFormation({ credentials: context.creds, region: 'eu-west-1' });
        const command = {stateBucketName: context.stateBucketName, stateObject: 'state.json', profile: profileForIntegrationTests, verbose: true, logicalName: 'cleanup-stacks', maxConcurrentStacks: 10, failedStacksTolerance: 0, maxConcurrentTasks: 10, failedTasksTolerance: 0 };

        await context.s3client.createBucket({ Bucket: context.stateBucketName }).promise();
        await context.s3client.upload({ Bucket: command.stateBucketName, Key: command.stateObject, Body: readFileSync(basePathForScenario + 'state.json') }).promise();

        const listStackInput: ListStacksInput = { StackStatusFilter: [ 'CREATE_COMPLETE', 'UPDATE_COMPLETE' ]  };
        stacksBeforeAll = await cfnClient.listStacks(listStackInput).promise();

        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + 'organization-tasks-buckets.yml', performCleanup: false});
        stacksAfterAddBucket = await cfnClient.listStacks(listStackInput).promise();

        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + 'organization-tasks-empty.yml', performCleanup: false});
        stacksAfterRenoveBucketNoCleanup = await cfnClient.listStacks(listStackInput).promise();

        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + 'organization-tasks-buckets.yml', performCleanup: false});
        stacksAfterAddBucket2 = await cfnClient.listStacks(listStackInput).promise();

        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + 'organization-tasks-empty.yml', performCleanup: true});
        stacksAfterRemoveBucketWithCleanup = await cfnClient.listStacks(listStackInput).promise();
    });

    test('before all scenario-cleanup-buckets not found', () => {
        const foundStack = stacksBeforeAll.StackSummaries.find(x=>x.StackName === 'scenario-cleanup-buckets');
        expect(foundStack).toBeUndefined();
    })

    test('after add bucket scenario-cleanup-buckets is found', () => {
        const foundStack = stacksAfterAddBucket.StackSummaries.find(x=>x.StackName === 'scenario-cleanup-buckets');
        expect(foundStack).toBeDefined();
    })

    test('after remove bucket without cleanup scenario-cleanup-buckets is found', () => {
        const foundStack = stacksAfterRenoveBucketNoCleanup.StackSummaries.find(x=>x.StackName === 'scenario-cleanup-buckets');
        expect(foundStack).toBeDefined();
    })

    test('after add bucket 2 scenario-cleanup-buckets is found', () => {
        const foundStack = stacksAfterAddBucket2.StackSummaries.find(x=>x.StackName === 'scenario-cleanup-buckets');
        expect(foundStack).toBeDefined();
    })

    test('after remove bucket with cleanup scenario-cleanup-buckets is not found', () => {
        const foundStack = stacksAfterRemoveBucketWithCleanup.StackSummaries.find(x=>x.StackName === 'scenario-cleanup-buckets');
        expect(foundStack).toBeUndefined();
    })

    afterAll(async () => {
        await baseAfterAll(context);
    })
});
