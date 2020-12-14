import { GetObjectOutput } from 'aws-sdk/clients/s3';
import { PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { PersistedState } from '~state/persisted-state';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, sleepForTest } from './base-integration-test';

const basePathForScenario = './test/integration-tests/resources/scenario-delegated-build-account/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;
    let stateAfterUpdate: GetObjectOutput;
    let stateAfterCleanup: GetObjectOutput;

    beforeAll(async () => {

        context = await baseBeforeAll('org-formation-test-delegated-build', 'BUILD_ACCT_AWS');
        await context.prepareStateBucket(basePathForScenario + '../state.json');
        const command = context.command;
        const s3client = context.s3client;


        await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + '0-update-organization.yml', masterAccountId: '102625093955'});
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '0-update-organization.yml', masterAccountId: '102625093955'});
        await sleepForTest(500);
        stateAfterUpdate = await s3client.getObject({Bucket: command.stateBucketName, Key: command.stateObject}).promise();

        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '9-cleanup-organization.yml', masterAccountId: '102625093955'});
        await sleepForTest(500);
        stateAfterCleanup = await s3client.getObject({Bucket: command.stateBucketName, Key: command.stateObject}).promise();
    });

    test('role was created in another account', () => {
        const str = stateAfterUpdate.Body.toString();
        const obj = JSON.parse(str);
        const state = new PersistedState(obj);
        expect(state).toBeDefined();
        const target = state.getTarget('org-formation-build-role', '549476213961', 'eu-west-1');
        expect(target).toBeDefined();

    })

    test('bucket was created in all accounts', () => {
        const str = stateAfterUpdate.Body.toString();
        const obj = JSON.parse(str);
        const state = new PersistedState(obj);
        expect(state).toBeDefined();
        const buildAccountTarget = state.getTarget('bucket', '340381375986', 'eu-west-1');
        const anotherAccountTarget = state.getTarget('bucket', '549476213961', 'eu-west-1');
        const masterAccountTarget = state.getTarget('bucket', '102625093955', 'eu-west-1');
        expect(buildAccountTarget).toBeDefined();
        expect(anotherAccountTarget).toBeDefined();
        expect(masterAccountTarget).toBeDefined();
    })

    test('roles where cleaned up', () => {
        const str = stateAfterCleanup.Body.toString();
        const obj = JSON.parse(str);
        const state = new PersistedState(obj);
        expect(state).toBeDefined();
        const target = state.getTarget('org-formation-build-role', '549476213961', 'eu-west-1');
        expect(target).toBeDefined();
        expect(target.lastCommittedHash).toBe('deleted');
    })

    test('buckets where cleaned up', () => {
        const str = stateAfterCleanup.Body.toString();
        const obj = JSON.parse(str);
        const state = new PersistedState(obj);
        expect(state).toBeDefined();
        const buildAccountTarget = state.getTarget('bucket', '340381375986', 'eu-west-1');
        const anotherAccountTarget = state.getTarget('bucket', '549476213961', 'eu-west-1');
        const masterAccountTarget = state.getTarget('bucket', '102625093955', 'eu-west-1');
        expect(buildAccountTarget).toBeDefined();
        expect(buildAccountTarget.lastCommittedHash).toBe('deleted');
        expect(anotherAccountTarget).toBeDefined();
        expect(anotherAccountTarget.lastCommittedHash).toBe('deleted');
        expect(masterAccountTarget).toBeDefined();
        expect(masterAccountTarget.lastCommittedHash).toBe('deleted');
    })

    afterAll(async () => {
        await baseAfterAll(context);
    });
});