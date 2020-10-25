import { ValidateTasksCommand, PerformTasksCommand } from "~commands/index";
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, sleepForTest } from "./base-integration-test";
import { GetObjectOutput } from "aws-sdk/clients/s3";

const basePathForScenario = './test/integration-tests/resources/scenario-global-params/';

describe('when using parameters in template', () => {
    let context: IIntegrationTestContext;
    let stateAfterFirstPerform: GetObjectOutput;
    let stateAfterSecondPerform: GetObjectOutput;

    beforeAll(async () => {
        try{
            context = await baseBeforeAll();

            await context.prepareStateBucket(basePathForScenario + '../state.json');
            const { command, stateBucketName, s3client } = context;

            await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + 'organization-tasks.yml' })
            await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + 'organization-tasks.yml' });

            await sleepForTest(500);
            stateAfterFirstPerform = await s3client.getObject({Bucket: stateBucketName, Key: command.stateObject}).promise();

            await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + 'organization-tasks.yml', parameters: 'includeMasterAccount=false'});
            await sleepForTest(500);
            stateAfterSecondPerform = await s3client.getObject({Bucket: stateBucketName, Key: command.stateObject}).promise();
        }
        catch(err) {
            expect(err.message).toBe('');
        }
    });

    test('first perform deploys both stacks', () => {
        const stateJSON = stateAfterFirstPerform.Body.toString();
        const state = JSON.parse(stateJSON);
        expect(state).toBeDefined();
        expect(state.stacks).toBeDefined();
        expect(Object.keys(state.stacks).length).toBe(2);
        expect(state.targets).toBeUndefined();
    });

    test('after second perform both stacks are gone', () => {
        const stateJSON = stateAfterSecondPerform.Body.toString();
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