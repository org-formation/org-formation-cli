import { PerformTasksCommand, BaseCliCommand } from "~commands/index";
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll } from "./base-integration-test";
import { ListStacksCommand, ListStacksCommandInput, ListStacksCommandOutput } from "@aws-sdk/client-cloudformation";

const basePathForScenario = './test/integration-tests/resources/scenario-cleanup-stacks/';


describe('when cleaning up stacks', () => {
    let context: IIntegrationTestContext;
    let stacksBeforeAll: ListStacksCommandOutput;
    let stacksAfterAddBucket: ListStacksCommandOutput;
    let stacksAfterRemoveBucketNoCleanup: ListStacksCommandOutput;
    let warnAfterRemoveBucketNoCleanup: string;
    let stacksAfterAddBucket2: ListStacksCommandOutput;
    let stacksAfterRemoveBucketWithCleanup: ListStacksCommandOutput;

    beforeAll(async () => {
        context = await baseBeforeAll();
        await context.prepareStateBucket(basePathForScenario + 'state.json');
        const { command, cfnClient} = context;

        const listStackInput: ListStacksCommandInput = { StackStatusFilter: [ 'CREATE_COMPLETE', 'UPDATE_COMPLETE' ]  };
        stacksBeforeAll = await cfnClient.send(new ListStacksCommand(listStackInput));

        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + 'organization-tasks-buckets.yml', performCleanup: false});
        stacksAfterAddBucket = await cfnClient.send(new ListStacksCommand(listStackInput));

        context.logWarningMock.mockReset();
        BaseCliCommand.CliCommandArgs = command;
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + 'organization-tasks-empty.yml', performCleanup: false});
        stacksAfterRemoveBucketNoCleanup = await cfnClient.send(new ListStacksCommand(listStackInput));
        warnAfterRemoveBucketNoCleanup = context.logWarningMock.mock.calls.join('\n');

        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + 'organization-tasks-buckets.yml', performCleanup: false});
        stacksAfterAddBucket2 = await cfnClient.send(new ListStacksCommand(listStackInput));

        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + 'organization-tasks-empty.yml', performCleanup: true});

        stacksAfterRemoveBucketWithCleanup = await cfnClient.send(new ListStacksCommand(listStackInput));
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
        const foundStack = stacksAfterRemoveBucketNoCleanup.StackSummaries.find(x=>x.StackName === 'scenario-cleanup-buckets');
        expect(foundStack).toBeDefined();
    })

    test('after remove bucket without cleanup informative message was printed', () => {
        expect(warnAfterRemoveBucketNoCleanup).toBeDefined();
        expect(warnAfterRemoveBucketNoCleanup).toEqual(expect.stringContaining('it seems you have removed a task'));
        expect(warnAfterRemoveBucketNoCleanup).toEqual(expect.stringContaining(context.stateBucketName));
        expect(warnAfterRemoveBucketNoCleanup).toEqual(expect.stringContaining('org-formation-test-v2'));
        expect(warnAfterRemoveBucketNoCleanup.indexOf('--state-object')).toBe(-1);
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
