import { PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { PersistedState } from '~state/persisted-state';
import { AwsUtil } from '~util/aws-util';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, sleepForTest } from './base-integration-test';
import { GetObjectCommand } from '@aws-sdk/client-s3';

const basePathForScenario = './test/integration-tests/resources/scenario-copyvalue-buildrole/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;
    let stateAfterUpdate: string;
    let stateAfterCleanup: string;

    beforeAll(async () => {

        context = await baseBeforeAll('org-formation-test-delegated-build', 'BUILD_ACCT_AWS');
        await context.prepareStateBucket(basePathForScenario + '../state.json');
        const command = context.command;
        const s3client = context.s3client;
        AwsUtil.SetMasterAccountId('102625093955');

        await ValidateTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '0-tasks.yml', masterAccountId: '102625093955' });
        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '0-tasks.yml', masterAccountId: '102625093955' });
        await sleepForTest(500);
        const stateAfterUpdateResponse = await s3client.send(new GetObjectCommand({ Bucket: command.stateBucketName, Key: command.stateObject }));
        stateAfterUpdate = await stateAfterUpdateResponse.Body.transformToString('utf-8');

        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '9-cleanup-organization.yml', masterAccountId: '102625093955', performCleanup: true });
        await sleepForTest(500);
        const stateAfterCleanupResponse = await s3client.send(new GetObjectCommand({ Bucket: command.stateBucketName, Key: command.stateObject }));
        stateAfterCleanup = await stateAfterCleanupResponse.Body.transformToString('utf-8');
    });

    test('buckets were created in both accounts', async () => {
        const obj = JSON.parse(stateAfterUpdate);
        const state = new PersistedState(obj);
        expect(state).toBeDefined();
        const source = state.getTarget('scenario-copyvalue-buildrole-source', '362239514602', 'eu-west-1');
        const target = state.getTarget('scenario-copyvalue-buildrole-target', '102625093955', 'eu-central-1');
        expect(source).toBeDefined();
        expect(target).toBeDefined();
    })

    test('buckets where cleaned up', async () => {
        const obj = JSON.parse(stateAfterCleanup);
        const state = new PersistedState(obj);
        expect(state).toBeDefined();
        const source = state.getTarget('scenario-copyvalue-buildrole-source', '362239514602', 'eu-west-1');
        const target = state.getTarget('scenario-copyvalue-buildrole-target', '102625093955', 'eu-central-1');
        expect(source).toBeUndefined();
        expect(target).toBeUndefined();
    })

    afterAll(async () => {
        await baseAfterAll(context);
    });
});