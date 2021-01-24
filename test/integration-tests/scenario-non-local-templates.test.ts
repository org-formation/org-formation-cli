import { GetObjectOutput } from 'aws-sdk/clients/s3';
import { AwsEvents } from '~aws-provider/aws-events';
import { PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { yamlParse } from '~yaml-cfn/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, sleepForTest } from './base-integration-test';

const basePathForScenario = './test/integration-tests/resources/scenario-non-local-templates/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;
    let organizationFileAfterPerformTasks: GetObjectOutput;
    let putOrganizationChangedEvent: jest.SpyInstance;

    beforeAll(async () => {

        putOrganizationChangedEvent = jest.spyOn(AwsEvents, 'putOrganizationChangedEvent').mockImplementation();

        context = await baseBeforeAll();
        await context.prepareStateBucket(basePathForScenario + '../state.json');
        const command = context.command;
        const s3client = context.s3client;

        await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + '0-tasks.yml', masterAccountId: '102625093955'});
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '0-tasks.yml', masterAccountId: '102625093955'});
        await sleepForTest(500);
        organizationFileAfterPerformTasks = await s3client.getObject({Bucket: command.stateBucketName, Key: 'organization.yml'}).promise();
    });

    it('as', ()=> {

    })

    afterAll(async () => {
        await baseAfterAll(context);
    });
});
