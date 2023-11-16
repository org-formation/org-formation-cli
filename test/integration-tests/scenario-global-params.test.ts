import { ValidateTasksCommand, PerformTasksCommand } from "~commands/index";
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, sleepForTest } from "./base-integration-test";
import { GetObjectCommand, GetObjectCommandOutput } from "@aws-sdk/client-s3";

const basePathForScenario = './test/integration-tests/resources/scenario-global-params/';

describe('when using parameters in template', () => {
    let context: IIntegrationTestContext;
    let stateAfterFirstPerform: GetObjectCommandOutput;
    let stateAfterSecondPerform: GetObjectCommandOutput;
    let stateAfterOverriddenParameter: GetObjectCommandOutput;
    let stateAfterOverriddenParameterCleanup: GetObjectCommandOutput;

    beforeAll(async () => {
        try{
            context = await baseBeforeAll();

            await context.prepareStateBucket(basePathForScenario + '../state.json');
            const { command, stateBucketName, s3client } = context;

            await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + '0-include.yml' })
            await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '0-include.yml' });

            await sleepForTest(500);
            stateAfterFirstPerform = await s3client.send(new GetObjectCommand({Bucket: stateBucketName, Key: command.stateObject}));

            await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '0-include.yml', parameters: 'includeMasterAccount=false'});
            await sleepForTest(500);
            stateAfterSecondPerform = await s3client.send(new GetObjectCommand({Bucket: stateBucketName, Key: command.stateObject}));

            await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-spread-operator.yml' })
            await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-spread-operator.yml' });
            await sleepForTest(500);
            stateAfterOverriddenParameter = await s3client.send(new GetObjectCommand({Bucket: stateBucketName, Key: command.stateObject}));

            await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-spread-operator.yml', parameters: 'includeMasterAccount=false'});
            await sleepForTest(500);
            stateAfterOverriddenParameterCleanup = await s3client.send(new GetObjectCommand({Bucket: stateBucketName, Key: command.stateObject}));
        }
        catch(err) {
            expect(err.message).toBe('');
        }
    });

    test('first perform deploys both stacks', async () => {
        const stateJSON = await stateAfterFirstPerform.Body.transformToString('utf-8');
        const state = JSON.parse(stateJSON);
        expect(state).toBeDefined();
        expect(state.stacks).toBeDefined();
        expect(Object.keys(state.stacks).length).toBe(2);
        expect(state.targets).toBeUndefined();
    });

    test('after second perform both stacks are gone', async () => {
        const stateJSON = await stateAfterSecondPerform.Body.transformToString('utf-8');
        const state = JSON.parse(stateJSON);
        expect(state).toBeDefined();
        expect(state.stacks).toBeDefined();
        expect(Object.keys(state.stacks).length).toBe(0);
        expect(state.targets).toBeUndefined();
    });

    test('after overriding parameter is used', async () => {
        const stateJSON = await stateAfterOverriddenParameter.Body.transformToString('utf-8');
        const state = JSON.parse(stateJSON);
        expect(state).toBeDefined();
        expect(state.stacks).toBeDefined();
        expect(Object.keys(state.stacks).length).toBe(2);
        const primaryRegionStack = state.stacks['yours-stack-name-primary-region'];
        expect(primaryRegionStack).toBeDefined();
        expect((Object.values(primaryRegionStack)[0] as any)['us-east-1']).toBeDefined();
        expect(state.targets).toBeUndefined();
    });

    test('after overriding parameter both stacks are gone', async () => {
        const stateJSON = await stateAfterOverriddenParameterCleanup.Body.transformToString('utf-8');
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