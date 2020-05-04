import { PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll } from './base-integration-test';
import { ListStacksOutput, GetStackPolicyOutput } from 'aws-sdk/clients/cloudformation';

const basePathForScenario = './test/integration-tests/resources/scenario-update-stacks-stack-policy/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;
    let stackPolicy: GetStackPolicyOutput;
    let listStacksResponseAfterCleanup: ListStacksOutput;
    let errorAfterUpdating: Error;

    beforeAll(async () => {

        context = await baseBeforeAll();
        await context.prepareStateBucket(basePathForScenario + 'state.json');
        const command = context.command;
        const { cfnClient } = context;

        await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-stacks-with-stack-policy.yml' })
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-stacks-with-stack-policy.yml' });
        stackPolicy = await cfnClient.getStackPolicy({StackName: 'test-with-stack-policy'}).promise();
        try {
            await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '2-update-stacks-with-stack-policy.yml' });
        } catch(err) {
            errorAfterUpdating = err;
        }
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '3-cleanup-stacks-with-stack-policy.yml', performCleanup: true });
        listStacksResponseAfterCleanup = await cfnClient.listStacks({StackStatusFilter: ['CREATE_COMPLETE']}).promise();
    });

    test('stack has Stack Policy', () => {
        expect(stackPolicy.StackPolicyBody).toBeDefined();
    });

    test('error was thrown when updating resources', () => {
        expect(errorAfterUpdating).toBeDefined();
    });

    test('cleanup will remove stack', () => {
        expect(listStacksResponseAfterCleanup).toBeDefined();
        expect(listStacksResponseAfterCleanup.StackSummaries).toBeDefined();
        const found = listStacksResponseAfterCleanup.StackSummaries.find(x=>x.StackName === 'test-with-stack-policy');
        expect(found).toBeUndefined();
    });

    afterAll(async () => {
        await baseAfterAll(context);
    });
});