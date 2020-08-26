import { PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll  } from './base-integration-test';

const basePathForScenario = './test/integration-tests/resources/scenario-register-type/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;


    beforeAll(async () => {
        context = await baseBeforeAll();
        await context.prepareStateBucket(basePathForScenario + '../state.json');
        const { command } = context;

        await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-register-type.yml' });
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-register-type.yml' });

        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '2-cleanup.yml', performCleanup: false})
    });

    test('test', () => {
        //expect(mockAfterInitialUpload.calls.length).toBe(1);
    });

    afterAll(async () => {
        await baseAfterAll(context);
    });
});