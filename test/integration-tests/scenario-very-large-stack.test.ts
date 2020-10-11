import { PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll } from './base-integration-test';
import { ListStacksOutput, GetStackPolicyOutput } from 'aws-sdk/clients/cloudformation';
import { ConsoleUtil } from '~util/console-util';

const basePathForScenario = './test/integration-tests/resources/scenario-very-large-stack/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;
    let veryLargeStack: GetStackPolicyOutput;

    beforeAll(async () => {

        context = await baseBeforeAll();
        await context.prepareStateBucket(basePathForScenario + '../state.json');
        const command = context.command;
        const { cfnClient } = context;

        await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-very-large-stack.yml' })
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-very-large-stack.yml' });

        veryLargeStack = await cfnClient.getStackPolicy({StackName: 'test-with-very-large-stack'}).promise();


        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '9-cleanup-very-large-stack.yml', performCleanup: true });

    });

    test('stack has Stack Policy', () => {
        expect(veryLargeStack).toBeDefined();
    });

});