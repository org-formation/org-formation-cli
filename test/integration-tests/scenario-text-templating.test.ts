import { PerformTasksCommand, ValidateTasksCommand } from "~commands/index";
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, sleepForTest } from "./base-integration-test";
import { PrintTasksCommand } from "~commands/print-tasks";
import { GetObjectCommandOutput, GetObjectCommand } from "@aws-sdk/client-s3";

const basePathForScenario = './test/integration-tests/resources/scenario-text-templating/';


describe('when cleaning up stacks', () => {
    let context: IIntegrationTestContext;
    let stateAfterPerformTasks: GetObjectCommandOutput;

    beforeAll(async () => {
        try{
            context = await baseBeforeAll();
            await context.prepareStateBucket(basePathForScenario + '../state.json');
            const { command, s3client, stateBucketName } = context;
            await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + 'organization-tasks.yml'});
            await PrintTasksCommand.Perform({...command, tasksFile: basePathForScenario + 'organization-tasks.yml'});
            await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + 'organization-tasks.yml'});

            await sleepForTest(500);
            stateAfterPerformTasks = await s3client.send(new GetObjectCommand({Bucket: stateBucketName, Key: command.stateObject}));
        }
        catch(err) {
            expect(err.message).toBe('');
        }
    });

    test('expect state to both deployed stacks (without include)', async () => {
        const str = await stateAfterPerformTasks.Body.transformToString('utf-8');
        const obj = JSON.parse(str);
        expect(obj.stacks).toBeDefined();
        expect(obj.stacks["nunjucks-template"]).toBeDefined();
        expect(Object.entries(obj.stacks["nunjucks-template"]).length).toBe(2);
    });

    test('expect state to both deployed stacks (with include)', async () => {
        const str = await stateAfterPerformTasks.Body.transformToString('utf-8');
        const obj = JSON.parse(str);
        expect(obj.stacks).toBeDefined();
        expect(obj.stacks["nunjucks-template2"]).toBeDefined();
        expect(Object.entries(obj.stacks["nunjucks-template2"]).length).toBe(2);
    });

    afterAll(async () => {
        await baseAfterAll(context);
    })
});