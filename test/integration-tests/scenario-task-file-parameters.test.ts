import { ValidateTasksCommand, PerformTasksCommand } from "~commands/index";
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, sleepForTest } from "./base-integration-test";
import { AwsUtil } from "~util/aws-util";
import { PrintTasksCommand } from "~commands/print-tasks";
import { DescribeStacksCommand, DescribeStacksCommandOutput, ListStacksCommand, ListStacksCommandOutput } from "@aws-sdk/client-cloudformation";

const basePathForScenario = './test/integration-tests/resources/scenario-task-file-parameters/';

describe('when using parameters in template', () => {
    let context: IIntegrationTestContext;
    let describedStacks: DescribeStacksCommandOutput;
    let describedStacks2: DescribeStacksCommandOutput;
    let describedStacksFromInclude: DescribeStacksCommandOutput;
    let describedStacksFromInclude2: DescribeStacksCommandOutput;
    let describedStacksFromInclude3: DescribeStacksCommandOutput;
    let describedStacksAfterCleanup: ListStacksCommandOutput;

    beforeAll(async () => {

        try {
            context = await baseBeforeAll();

            await context.prepareStateBucket(basePathForScenario + '../state.json');
            const { command, cfnClient } = context;

            await ValidateTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-task-file-with-parameters.yml', parameters: "partition=aws" });
            await PrintTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-task-file-with-parameters.yml', parameters: "partition=aws" });
            await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-task-file-with-parameters.yml', parameters: "partition=aws" });
            await sleepForTest(1000);

            describedStacks = await cfnClient.send(new DescribeStacksCommand({ StackName: 'my-scenario-stack-parameters' }));
            describedStacks2 = await cfnClient.send(new DescribeStacksCommand({ StackName: 'my-scenario-stack-parameters-2' }));
            describedStacksFromInclude = await cfnClient.send(new DescribeStacksCommand({ StackName: 'something-else-scenario-stack-parameters' }));
            describedStacksFromInclude2 = await cfnClient.send(new DescribeStacksCommand({ StackName: 'something-different-scenario-stack-parameters' }));
            describedStacksFromInclude3 = await cfnClient.send(new DescribeStacksCommand({ StackName: 'something-with-pseudo-param-scenario-stack-parameters' }));

            await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-task-file-with-parameters.yml', parameters: 'includeMasterAccount=false partition=aws' });
            describedStacksAfterCleanup = await cfnClient.send(new ListStacksCommand({ StackStatusFilter: ['CREATE_COMPLETE', 'UPDATE_COMPLETE'] }));
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
