import { PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { IState } from '~state/persisted-state';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll } from './base-integration-test';
import { GetObjectCommand, ListObjectsCommand } from '@aws-sdk/client-s3';

const basePathForScenario = './test/integration-tests/resources/scenario-no-bucket/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;

    beforeAll(async () => {

        context = await baseBeforeAll();
        const command = context.command;

        await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-no-bucket.yml' })
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-no-bucket.yml' });

    });

    test('s3 bucket and state file got created', async () => {
        const objects = await context.s3client.send(new ListObjectsCommand({ Bucket: context.stateBucketName}));
        expect(objects).toBeDefined();
        expect(objects.Contents).toBeDefined();

        const obj = objects.Contents.find(x=>x.Key === "state.json");
        expect(obj).toBeDefined();
    });

    test('s3 bucket and state file got created', async () => {
        const obj = await context.s3client.send(new GetObjectCommand({ Bucket: context.stateBucketName, Key: 'state.json'}));
        expect(obj).toBeDefined();
        expect(obj.Body).toBeDefined();
        const object = JSON.parse(obj.Body.toString()) as IState;
        expect(object.masterAccountId).toBe('102625093955');
        expect(object.stacks["integration-test-my-role"]).toBeDefined();
        expect(object.stacks["integration-test-my-role"]["340381375986"]).toBeDefined();
        expect(object.stacks["integration-test-my-role"]["340381375986"]["us-east-1"]).toBeDefined();

    });
    afterAll(async () => {
        await baseAfterAll(context);
    });
});