import { AwsEvents } from '~aws-provider/aws-events';
import { PerformTasksCommand } from '~commands/index';
import { yamlParse } from '~yaml-cfn/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, sleepForTest } from './base-integration-test';
import { GetObjectCommand, GetObjectCommandOutput } from '@aws-sdk/client-s3';

const basePathForScenario = './test/integration-tests/resources/scenario-perform-tasks/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;
    let organizationFileAfterPerformTasks: GetObjectCommandOutput;
    let putOrganizationChangedEvent: jest.SpyInstance;

    beforeAll(async () => {

        putOrganizationChangedEvent = jest.spyOn(AwsEvents, 'putOrganizationChangedEvent').mockImplementation();

        context = await baseBeforeAll();
        await context.prepareStateBucket(basePathForScenario + '../state.json');
        const command = context.command;
        const s3client = context.s3client;

        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '0-tasks.yml', masterAccountId: '102625093955'});
        await sleepForTest(500);
        organizationFileAfterPerformTasks = await s3client.send(new GetObjectCommand({Bucket: command.stateBucketName, Key: 'organization.yml'}));
    });

    test('organization file was uploaded to s3', ()=> {
        expect(organizationFileAfterPerformTasks).toBeDefined();
        expect(organizationFileAfterPerformTasks.Body).toBeDefined();
    })

    test('can load organization file as yaml', async ()=> {
        const str = await organizationFileAfterPerformTasks.Body.transformToString('utf-8');
        const x = yamlParse(str);
        expect(x).toBeDefined();
        expect(x.Organization).toBeDefined();
    });

    test('event has been raised', ()=> {
        expect(putOrganizationChangedEvent).toHaveBeenCalled();
        expect(putOrganizationChangedEvent).toHaveBeenLastCalledWith(context.command.stateBucketName, 'organization.yml');
    });

    afterAll(async () => {
        await baseAfterAll(context);
    });
});
