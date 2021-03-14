import { PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { PrintTasksCommand } from '~commands/print-tasks';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll } from './base-integration-test';

const basePathForScenario = './test/integration-tests/resources/scenario-new-account/';

describe('when adding new account', () => {
    let context: IIntegrationTestContext;

    beforeAll(async () => {
        context = await baseBeforeAll();
        await context.prepareStateBucket(basePathForScenario + '../state.json');

    });
    test('validate doesnt throw', async () => {

        const { command } = context;
        await ValidateTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + 'task.yml' });
    });

    test('print doesnt throw', async () => {
        const { command } = context;

        await PrintTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + 'task.yml' });
    });

    afterAll(async () => {
        await baseAfterAll(context);
    });
});