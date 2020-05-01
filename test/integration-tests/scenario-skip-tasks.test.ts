import { ValidateTasksCommand, PerformTasksCommand } from "~commands/index";
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll } from "./base-integration-test";
import { GetObjectOutput } from "aws-sdk/clients/s3";

const basePathForScenario = './test/integration-tests/resources/scenario-skip-tasks/';

describe('when using parameters in template', () => {
    let context: IIntegrationTestContext;
    let stateAfterSkipTasks: GetObjectOutput;
    beforeAll(async () => {

        try{
            context = await baseBeforeAll();

            await context.prepareStateBucket(basePathForScenario + 'state.json');
            const { command, stateBucketName, s3client } = context;

            await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + 'skip-tasks.yml' })
            await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + 'skip-tasks.yml' });

            stateAfterSkipTasks = await s3client.getObject({Bucket: stateBucketName, Key: command.stateObject}).promise();
        }
        catch(err) {
            expect(err.message).toBe('');
        }
    });

    test('state is not updated', () => {
        const stateJSON = stateAfterSkipTasks.Body.toString();
        const state = JSON.parse(stateJSON);
        expect(state).toBeDefined();
        expect(state.stacks).toBeDefined();
        expect(Object.keys(state.stacks)).toBe(0);
        expect(state.targets).toBeUndefined();
    });

    afterAll(async () => {
        await baseAfterAll(context);
    });
});