import { GetObjectOutput } from 'aws-sdk/clients/s3';
import { readFileSync } from 'fs';
import { IPerformTasksCommandArgs, PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { PersistedState } from '~state/persisted-state';
import { AwsUtil } from '~util/aws-util';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, sleepForTest } from './base-integration-test';

const basePathForScenario = './test/integration-tests/resources/scenario-detached-perform-tasks/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;
    let stateAfterUpdate: GetObjectOutput;
    let stateAfterCleanup: GetObjectOutput;

    beforeAll(async () => {

        context = await baseBeforeAll('org-formation-test-delegated-build', 'BUILD_ACCT_AWS');
        await context.prepareStateBucket(basePathForScenario + 'state.json');
        const { s3client } = context;
        await s3client.upload({ Bucket: context.command.stateBucketName, Key: 'organization.yml', Body: readFileSync(basePathForScenario + 'organization.yml') }).promise();

        const command : IPerformTasksCommandArgs = {...context.command,
            organizationStateObject: 'state.json', stateObject: 'task-state.json',
            organizationFile: 's3://' + context.command.stateBucketName + '/organization.yml' };

        AwsUtil.SetMasterAccountId('102625093955');

        await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + '0-tasks.yml', masterAccountId: '102625093955'});
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '0-tasks.yml', masterAccountId: '102625093955'});
        await sleepForTest(500);
        stateAfterUpdate = await s3client.getObject({Bucket: command.stateBucketName, Key: command.stateObject}).promise();
        await sleepForTest(500);
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '9-cleanup.yml', masterAccountId: '102625093955', performCleanup: true});
        await sleepForTest(500);
        stateAfterCleanup = await s3client.getObject({Bucket: command.stateBucketName, Key: command.stateObject}).promise();
    });

    test('bucket was created in all accounts', () => {
        const str = stateAfterUpdate.Body.toString();
        const obj = JSON.parse(str);
        const state = new PersistedState(obj);
        expect(state).toBeDefined();
        const buildAccountTarget = state.getTarget('bucket', '340381375986', 'eu-west-1');
        const anotherAccountTarget = state.getTarget('bucket', '549476213961', 'eu-west-1');
        const masterAccountTarget = state.getTarget('bucket', '102625093955', 'eu-west-1');
        const accountBTarget = state.getTarget('bucket', '362239514602', 'eu-west-1');
        const accountCTarget = state.getTarget('bucket', '673026687213', 'eu-west-1');
        expect(buildAccountTarget).toBeDefined();
        expect(anotherAccountTarget).toBeDefined();
        expect(masterAccountTarget).toBeDefined();
        expect(accountBTarget).toBeDefined();
        expect(accountCTarget).toBeDefined();
    })

    test('buckets where cleaned up', () => {
        const str = stateAfterCleanup.Body.toString();
        const obj = JSON.parse(str);
        const state = new PersistedState(obj);
        expect(state).toBeDefined();
        const buildAccountTarget = state.getTarget('bucket', '340381375986', 'eu-west-1');
        const anotherAccountTarget = state.getTarget('bucket', '549476213961', 'eu-west-1');
        const masterAccountTarget = state.getTarget('bucket', '102625093955', 'eu-west-1');
        const accountBTarget = state.getTarget('bucket', '362239514602', 'eu-west-1');
        const accountCTarget = state.getTarget('bucket', '673026687213', 'eu-west-1');
        expect(buildAccountTarget).toBeUndefined();
        expect(anotherAccountTarget).toBeUndefined();
        expect(masterAccountTarget).toBeUndefined();
        expect(accountBTarget).toBeUndefined();
        expect(accountCTarget).toBeUndefined();
    })


    afterAll(async () => {
        await baseAfterAll(context);
    });
});