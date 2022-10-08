import { ValidateTasksCommand, PerformTasksCommand } from "~commands/index";
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, sleepForTest } from "./base-integration-test";
import { DescribeStacksOutput, ListStacksOutput } from "aws-sdk/clients/cloudformation";
import { AwsUtil } from "~util/aws-util";
import { PrintTasksCommand } from "~commands/print-tasks";

const basePathForScenario = './test/integration-tests/resources/scenario-task-file-parameters/';

describe('when using parameters in template', () => {
    let context: IIntegrationTestContext;
    let describedStacks: DescribeStacksOutput;
    let describedStacks2: DescribeStacksOutput;
    let describedStacksFromInclude: DescribeStacksOutput;
    let describedStacksFromInclude2: DescribeStacksOutput;
    let describedStacksFromInclude3: DescribeStacksOutput;
    let describedStacksAfterCleanup: ListStacksOutput;

    beforeAll(async () => {

        try {
            context = await baseBeforeAll();

            await AwsUtil.InitializeWithCurrentPartition();
            await context.prepareStateBucket(basePathForScenario + '../state.json');
            const { command, cfnClient } = context;

            await ValidateTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-task-file-with-parameters.yml', parameters: "partition=aws" });
            await PrintTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-task-file-with-parameters.yml', parameters: "partition=aws" });
            await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-task-file-with-parameters.yml', parameters: "partition=aws" });
            await sleepForTest(1000);

            describedStacks = await cfnClient.describeStacks({ StackName: 'my-scenario-stack-parameters' }).promise();
            describedStacks2 = await cfnClient.describeStacks({ StackName: 'my-scenario-stack-parameters-2' }).promise();
            describedStacksFromInclude = await cfnClient.describeStacks({ StackName: 'something-else-scenario-stack-parameters' }).promise();
            describedStacksFromInclude2 = await cfnClient.describeStacks({ StackName: 'something-different-scenario-stack-parameters' }).promise();
            describedStacksFromInclude3 = await cfnClient.describeStacks({ StackName: 'something-with-pseudo-param-scenario-stack-parameters' }).promise();

            await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-task-file-with-parameters.yml', parameters: 'includeMasterAccount=false partition=aws' });
            describedStacksAfterCleanup = await cfnClient.listStacks({ StackStatusFilter: ['CREATE_COMPLETE', 'UPDATE_COMPLETE'] }).promise();
        } catch (err) {
            expect(err.message).toBeUndefined();
        }
    });
    test('stack can be created using variable name and binding', () => {
        expect(describedStacks).toBeDefined();
    })

    test('organization binding from parameter is used when deploying', () => {
        expect(describedStacks2).toBeDefined();
    })

    test('parameters can be passed down to included template', () => {
        expect(describedStacksFromInclude).toBeDefined();
    })

    test('parameters can be passed down to included template from perform-tasks option', () => {
        expect(describedStacksFromInclude2).toBeDefined();
    })


    test('pseudo parameters can be used in included template', () => {
        expect(describedStacksFromInclude3).toBeDefined();
    })

    test('stack can be removed using variable binding and passing parameters', () => {
        let summary = describedStacksAfterCleanup.StackSummaries.find(x => x.StackName.endsWith('scenario-stack-parameters'));
        expect(summary).toBeUndefined();
    })

    afterAll(async () => {
        await baseAfterAll(context);
    });
});
