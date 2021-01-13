import { readFileSync } from 'fs';
import { PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { PrintTasksCommand } from '~commands/print-tasks';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll } from './base-integration-test';

const basePathForScenario = './test/integration-tests/resources/scenario-organization-file-s3/';

describe('when using organization file from s3', () => {
    let context: IIntegrationTestContext;

    beforeAll(async () => {
        context = await baseBeforeAll();
        await context.prepareStateBucket(basePathForScenario + '../state.json');
    });

    test('validate doesnt throw', async () => {
        const { command, s3client } = context;
        await s3client.upload( { Bucket: command.stateBucketName, Key: 'organization.yml', Body: readFileSync(basePathForScenario + '/organization.yml')}).promise();
        await ValidateTasksCommand.Perform({...command, organizationFile: `s3://${command.stateBucketName}/organization.yml`, tasksFile: basePathForScenario + 'task.yml' });
    });

    test('perform tasks doesnt throw', async () => {
        const { command, s3client } = context;
        await s3client.upload( { Bucket: command.stateBucketName, Key: 'organization.yml', Body: readFileSync(basePathForScenario + '/organization.yml')}).promise();
        await PerformTasksCommand.Perform({...command, organizationFile: `s3://${command.stateBucketName}/organization.yml`, tasksFile: basePathForScenario + 'task.yml' });
    });


    test('print tasks doesnt throw', async () => {
        const { command, s3client } = context;
        await s3client.upload( { Bucket: command.stateBucketName, Key: 'organization.yml', Body: readFileSync(basePathForScenario + '/organization.yml')}).promise();
        await PrintTasksCommand.Perform({...command, organizationFile: `s3://${command.stateBucketName}/organization.yml`, tasksFile: basePathForScenario + 'task.yml' });
    });


    afterAll(async () => {
        await baseAfterAll(context);
    });
});