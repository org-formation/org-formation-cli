import {  PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll } from './base-integration-test';
import { DescribeStacksCommandOutput, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';

const basePathForScenario = './test/integration-tests/resources/scenario-json-template/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;
    let jsonStack: DescribeStacksCommandOutput;

    beforeAll(async () => {

        context = await baseBeforeAll();
        await context.prepareStateBucket(basePathForScenario + '../state.json');
        const command = context.command;
        const { cfnClient } = context;

        await ValidateTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-deploy-json-stack.yml' })
        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-deploy-json-stack.yml' });

        jsonStack = await cfnClient.send(new DescribeStacksCommand({ StackName: 'test-with-json' }));


        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '9-cleanup-json-stack.yml', performCleanup: true });

    });

    test('stack was deployed successfully', () => {
        expect(jsonStack).toBeDefined();
        expect(jsonStack.Stacks.length).toBe(1);
        expect(jsonStack.Stacks[0]).toBeDefined();
        expect(jsonStack.Stacks[0].StackStatus).toBe('CREATE_COMPLETE');
    });

});