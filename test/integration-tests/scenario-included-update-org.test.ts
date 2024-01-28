import { ValidateTasksCommand } from "~commands/index";
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll } from "./base-integration-test";
import { PrintTasksCommand } from "~commands/print-tasks";
import { GenericTaskRunner } from "~core/generic-task-runner";

const basePathForScenario = './test/integration-tests/resources/scenario-included-update-org/';


describe('when cleaning up stacks', () => {
    let context: IIntegrationTestContext;


    beforeAll(async () => {
        context = await baseBeforeAll();
        await context.prepareStateBucket(basePathForScenario + '../state.json');
        GenericTaskRunner.RethrowTaskErrors = true;
    });

    test('validate tasks with newly added accounts doesnt throw', async () => {
        const { command } = context;
        await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + 'toplevel-tasks.yml', organizationFile: basePathForScenario + 'organization.yml'});
    });

    test('print tasks with newly added accounts doesnt throw', async () => {
        const { command } = context;
        await PrintTasksCommand.Perform({...command, tasksFile: basePathForScenario + 'toplevel-tasks.yml', organizationFile: basePathForScenario + 'organization.yml'});
    });

    afterAll(async () => {
        await baseAfterAll(context);
    })
});