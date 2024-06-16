import { AwsOrganization } from '~aws-provider/aws-organization';
import { AwsOrganizationReader } from '~aws-provider/aws-organization-reader';
import { PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { PersistedState } from '~state/persisted-state';
import { AwsUtil } from '~util/aws-util';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, sleepForTest } from './base-integration-test';
import { GetObjectCommand, GetObjectCommandOutput } from '@aws-sdk/client-s3';

const basePathForScenario = './test/integration-tests/resources/scenario-delegated-build-account/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;
    let stateAfterUpdate: string;
    let stateAfterCleanup: string;
    let orgAfterUpdate: AwsOrganization;
    let orgAfterCleanup: AwsOrganization;

    beforeAll(async () => {

        context = await baseBeforeAll('org-formation-test-delegated-build', 'BUILD_ACCT_AWS');
        await context.prepareStateBucket(basePathForScenario + '../state.json');
        const command = context.command;
        const s3client = context.s3client;
        const orgClient = AwsUtil.GetOrganizationsService('102625093955', 'OrganizationFormationBuildRole')

        AwsUtil.SetMasterAccountId('102625093955');

        await ValidateTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '0-update-organization.yml', masterAccountId: '102625093955' });
        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '0-update-organization.yml', masterAccountId: '102625093955' });
        await sleepForTest(500);
        const stateAfterUpdateResponse = await s3client.send(new GetObjectCommand({ Bucket: command.stateBucketName, Key: command.stateObject }));
        stateAfterUpdate = await stateAfterUpdateResponse.Body.transformToString('utf-8');

        await sleepForTest(500);
        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-update-organization.yml', masterAccountId: '102625093955' });
        await sleepForTest(500);
        orgAfterUpdate = new AwsOrganization(new AwsOrganizationReader(orgClient, { masterAccountId: '102625093955', masterAccountRoleName: 'OrganizationFormationBuildRole' }));
        await orgAfterUpdate.initialize();

        await sleepForTest(500);
        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '9-cleanup-organization.yml', masterAccountId: '102625093955', performCleanup: true });
        await sleepForTest(500);
        const stateAfterCleanupResponse = await s3client.send(new GetObjectCommand({ Bucket: command.stateBucketName, Key: command.stateObject }));
        stateAfterCleanup = await stateAfterCleanupResponse.Body.transformToString('utf-8');
        await sleepForTest(500);
        orgAfterCleanup = new AwsOrganization(new AwsOrganizationReader(orgClient, { masterAccountId: '102625093955', masterAccountRoleName: 'OrganizationFormationBuildRole' }));
        await orgAfterCleanup.initialize();
    });

    test('role was created in another account', async () => {
        const obj = JSON.parse(stateAfterUpdate);
        const state = new PersistedState(obj);
        expect(state).toBeDefined();
        const target = state.getTarget('org-formation-build-role', '549476213961', 'eu-west-1');
        expect(target).toBeDefined();
    })

    test('role was created in account b', async () => {
        const obj = JSON.parse(stateAfterUpdate);
        const state = new PersistedState(obj);
        expect(state).toBeDefined();
        const target = state.getTarget('org-formation-build-role', '362239514602', 'eu-west-1');
        expect(target).toBeDefined();
    })

    test('role was created in account c', async () => {
        const obj = JSON.parse(stateAfterUpdate);
        const state = new PersistedState(obj);
        expect(state).toBeDefined();
        const target = state.getTarget('org-formation-build-role-c', '673026687213', 'eu-west-1');
        expect(target).toBeDefined();
    })

    test('alias was updated in master account', () => {
        expect(orgAfterUpdate.masterAccount.Alias).toBeDefined();
        expect(orgAfterUpdate.masterAccount.Alias).toBe('alias-102625093955');
    })

    test('alias was updated in account b', () => {
        const accountB = orgAfterUpdate.accounts.find(x => x.Id === '362239514602')
        expect(accountB.Alias).toBeDefined();
        expect(accountB.Alias).toBe('alias-362239514602');
    })

    test('alias was updated in build account', () => {
        const buildAccount = orgAfterUpdate.accounts.find(x => x.Id === '340381375986')
        expect(buildAccount.Alias).toBeDefined();
        expect(buildAccount.Alias).toBe('alias-340381375986');
    })

    test('alias was updated in another account', () => {
        const anotherAccount = orgAfterUpdate.accounts.find(x => x.Id === '549476213961')
        expect(anotherAccount.Alias).toBeDefined();
        expect(anotherAccount.Alias).toBe('alias-549476213961');
    })

    test('pwd policy was updated in master account', () => {
        expect(orgAfterUpdate.masterAccount.PasswordPolicy).toBeDefined();
    })

    test('pwd policy was updated in account b', () => {
        const accountB = orgAfterUpdate.accounts.find(x => x.Id === '362239514602')
        expect(accountB.PasswordPolicy).toBeDefined();
    })

    test('pwd policy was updated in build account', () => {
        const buildAccount = orgAfterUpdate.accounts.find(x => x.Id === '340381375986')
        expect(buildAccount.PasswordPolicy).toBeDefined();
    })

    test('pwd policy was updated in another account', () => {
        const anotherAccount = orgAfterUpdate.accounts.find(x => x.Id === '549476213961')
        expect(anotherAccount.PasswordPolicy).toBeDefined();
    })
    test('bucket was created in all accounts', async () => {
        const obj = JSON.parse(stateAfterUpdate);
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

    test('alias was removed from master account', () => {
        expect(orgAfterCleanup.masterAccount.Alias).toBeUndefined();
    })

    test('alias was removed from account b', () => {
        const accountB = orgAfterCleanup.accounts.find(x => x.Id === '362239514602')
        expect(accountB.Alias).toBeUndefined();
    })

    test('alias was removed from build account', () => {
        const buildAccount = orgAfterCleanup.accounts.find(x => x.Id === '340381375986')
        expect(buildAccount.Alias).toBeUndefined();
    })

    test('alias was removed from another account', () => {
        const anotherAccount = orgAfterCleanup.accounts.find(x => x.Id === '549476213961')
        expect(anotherAccount.Alias).toBeUndefined();
    })

    test('pwd policy was removed from master account', () => {
        expect(orgAfterCleanup.masterAccount.PasswordPolicy).toBeUndefined();
    })

    test('pwd policy was removed from account b', () => {
        const accountB = orgAfterCleanup.accounts.find(x => x.Id === '362239514602')
        expect(accountB.PasswordPolicy).toBeUndefined();
    })

    test('pwd policy was removed from build account', () => {
        const buildAccount = orgAfterCleanup.accounts.find(x => x.Id === '340381375986')
        expect(buildAccount.PasswordPolicy).toBeUndefined();
    })

    test('pwd policy was updated in another account', () => {
        const anotherAccount = orgAfterCleanup.accounts.find(x => x.Id === '549476213961')
        expect(anotherAccount.PasswordPolicy).toBeUndefined();
    })

    test('roles where cleaned up', async () => {
        const obj = JSON.parse(stateAfterCleanup);
        const state = new PersistedState(obj);
        expect(state).toBeDefined();
        const target = state.getTarget('org-formation-build-role', '549476213961', 'eu-west-1');
        expect(target).toBeUndefined();
    })

    test('buckets where cleaned up', async () => {
        const obj = JSON.parse(stateAfterCleanup);
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