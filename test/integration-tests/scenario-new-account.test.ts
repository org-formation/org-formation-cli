import { PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll } from './base-integration-test';

const basePathForScenario = './test/integration-tests/resources/scenario-new-account/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;

    test('validate doesnt throw', async () => {
        context = await baseBeforeAll();
        await context.prepareStateBucket(basePathForScenario + '../state.json');
        const { command } = context;

        await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + 'task.yml' });
    });

    afterAll(async () => {
        await baseAfterAll(context);
    });
});