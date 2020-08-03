import { ValidateTasksCommand, PerformTasksCommand } from "~commands/index";
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll } from "./base-integration-test";
import { DescribeStacksOutput, ListStacksOutput } from "aws-sdk/clients/cloudformation";

const basePathForScenario = './test/integration-tests/resources/scenario-task-file-parameters/';

describe('when using parameters in template', () => {
    let context: IIntegrationTestContext;
    let describedStacks: DescribeStacksOutput;
    let describedStacksFromInclude: DescribeStacksOutput;
    let describedStacksAfterCleanup: ListStacksOutput;

    beforeAll(async () => {

        try{
            context = await baseBeforeAll();

            await context.prepareStateBucket(basePathForScenario + '../state.json');
            const { command, cfnClient } = context;

            await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-task-file-with-parameters.yml' })
            await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-task-file-with-parameters.yml' });

            describedStacks = await cfnClient.describeStacks({StackName: 'my-scenario-stack-parameters'}).promise();
            describedStacksFromInclude = await cfnClient.describeStacks({StackName: 'something-else-scenario-stack-parameters'}).promise();

            await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-task-file-with-parameters.yml', parameters: 'includeMasterAccount=false' });
            describedStacksAfterCleanup = await cfnClient.listStacks({StackStatusFilter: ['CREATE_COMPLETE', 'UPDATE_COMPLETE']}).promise();
        } catch(err) {
            expect(err.message).toBeUndefined();
        }
    });

    test('stack can be created using variable name and binding', () => {
        expect(describedStacks).toBeDefined();
    })

    test('parameters can be passed down to included template', () => {
        expect(describedStacksFromInclude).toBeDefined();
    })

    test('stack can be removed using variable binding and passing parameters', () => {
        let summary = describedStacksAfterCleanup.StackSummaries.find(x=>x.StackName.endsWith('scenario-stack-parameters'));
        expect(summary).toBeUndefined();
    })

    afterAll(()=> {
        baseAfterAll(context);
    });
});
