import { GetObjectOutput } from 'aws-sdk/clients/s3';
import { AwsEvents } from '~aws-provider/aws-events';
import { PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { PersistedState } from '~state/persisted-state';
import { yamlParse } from '~yaml-cfn/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, sleepForTest } from './base-integration-test';

const basePathForScenario = './test/integration-tests/resources/scenario-non-local-templates/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;
    let stateAfterUpdate: GetObjectOutput;
    let putOrganizationChangedEvent: jest.SpyInstance;

    beforeAll(async () => {

        putOrganizationChangedEvent = jest.spyOn(AwsEvents, 'putOrganizationChangedEvent').mockImplementation();

        context = await baseBeforeAll();
        const { s3client } = context;
        await context.prepareStateBucket(basePathForScenario + '../state.json');
        const command = context.command;

        await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + '0-tasks.yml', masterAccountId: '102625093955'});
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '0-tasks.yml', masterAccountId: '102625093955'});
        await sleepForTest(1000);
        stateAfterUpdate = await s3client.getObject({Bucket: command.stateBucketName, Key: command.stateObject}).promise();

        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '9-cleanup-tasks.yml', masterAccountId: '102625093955'});
    });

    it('template is deployed successfully over s3', ()=> {
        const str = stateAfterUpdate.Body.toString();
        const obj = JSON.parse(str);
        const state = new PersistedState(obj);
        expect(state).toBeDefined();
        const target = state.getTarget('buckets-from-remote-s3-template', '102625093955', 'eu-west-1');
        expect(target).toBeDefined();
    })

    it('template is deployed successfully over https', ()=> {
        const str = stateAfterUpdate.Body.toString();
        const obj = JSON.parse(str);
        const state = new PersistedState(obj);
        expect(state).toBeDefined();
        const target = state.getTarget('buckets-from-remote-https-template', '102625093955', 'eu-west-1');
        expect(target).toBeDefined();
    })

    afterAll(async () => {
        await baseAfterAll(context);
    });
});
