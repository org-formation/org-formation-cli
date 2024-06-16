import { PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll } from './base-integration-test';
import { DescribeStacksCommand, DescribeStacksCommandOutput } from '@aws-sdk/client-cloudformation';

const basePathForScenario = './test/integration-tests/resources/scenario-very-large-stack/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;
    let veryLargeStack: DescribeStacksCommandOutput;

    beforeAll(async () => {

        context = await baseBeforeAll();
        await context.prepareStateBucket(basePathForScenario + '../state.json');
        const command = context.command;
        const { cfnClient } = context;

        await ValidateTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-deploy-very-large-stack.yml' })
        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-deploy-very-large-stack.yml' });

        veryLargeStack = await cfnClient.send(new DescribeStacksCommand({ StackName: 'test-with-very-large-stack' }));


        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '9-cleanup-very-large-stack.yml', performCleanup: true });

    });

    test('stack was deployed successfully', () => {
        expect(veryLargeStack).toBeDefined();
        expect(veryLargeStack.Stacks.length).toBe(1);
        expect(veryLargeStack.Stacks[0]).toBeDefined();
        expect(veryLargeStack.Stacks[0].StackStatus).toBe('CREATE_COMPLETE');
    });
});