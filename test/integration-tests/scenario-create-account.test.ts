import { AwsOrganization } from '~aws-provider/aws-organization';
import { AwsOrganizationReader } from '~aws-provider/aws-organization-reader';
import { PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { PersistedState } from '~state/persisted-state';
import { AwsUtil } from '~util/aws-util';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, sleepForTest } from './base-integration-test';
import { GetObjectCommand, GetObjectCommandOutput } from '@aws-sdk/client-s3';

const basePathForScenario = './test/integration-tests/resources/scenario-create-account/';

/**
 * Run this test only for debugging purposes as it actually creates a new account.
 *
 * Closing account is quite limited and for now manual after running this test
 *
 * https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/organizations/command/CloseAccountCommand/
 */
describe.skip('when calling org-formation perform tasks', () => {
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

    test('first organization update succeeded', async () => {
        expect(stateAfterUpdate).toBeDefined();
    })

    test('second organization update succeeded that creates account', async () => {
        expect(orgAfterUpdate).toBeDefined();
    })

    test('cleanup organization update succeeded', async () => {
        expect(orgAfterCleanup).toBeDefined();
    })

    afterAll(async () => {
        await baseAfterAll(context);
    });
});