import { ValidateTasksCommand, PerformTasksCommand } from "~commands/index";
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll } from "./base-integration-test";
import { GetObjectCommandOutput, GetObjectCommand } from "@aws-sdk/client-s3";

const basePathForScenario = './test/integration-tests/resources/scenario-skip-tasks/';

describe('when using parameters in template', () => {
    let context: IIntegrationTestContext;
    let stateAfterSkipTasks: GetObjectCommandOutput;
    beforeAll(async () => {

        try{
            context = await baseBeforeAll();

            await context.prepareStateBucket(basePathForScenario + '../state.json');
            const { command, stateBucketName, s3client } = context;

            await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + 'skip-tasks.yml' })
            await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + 'skip-tasks.yml' });

            stateAfterSkipTasks = await s3client.send(new GetObjectCommand({Bucket: stateBucketName, Key: command.stateObject}));
        }
        catch(err) {
            expect(err.message).toBe('');
        }
    });

    test('state is not updated', async () => {
        const stateJSON = await stateAfterSkipTasks.Body.transformToString('utf-8');
        const state = JSON.parse(stateJSON);
        expect(state).toBeDefined();
        expect(state.stacks).toBeDefined();
        expect(Object.keys(state.stacks).length).toBe(0);
        expect(state.targets).toBeUndefined();
    });

    afterAll(async () => {
        await baseAfterAll(context);
    });
});