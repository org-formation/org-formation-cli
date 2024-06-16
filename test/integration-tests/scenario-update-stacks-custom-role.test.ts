import { PerformTasksCommand, ValidateTasksCommand, UpdateOrganizationCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, sleepForTest } from './base-integration-test';
import { AwsUtil } from '~util/aws-util';
import { CloudFormationClient, DescribeStacksCommand, ListStacksCommand, ListStacksCommandOutput, Stack } from '@aws-sdk/client-cloudformation';

const basePathForScenario = './test/integration-tests/resources/scenario-update-stacks-custom-role/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;
    let cfnClient: CloudFormationClient;

    let stackAfterUpdateWithCustomRole: Stack;
    let listStacksResponseAfterCleanup: ListStacksCommandOutput;

    beforeAll(async () => {

        context = await baseBeforeAll();
        cfnClient = AwsUtil.GetCloudFormationService('340381375986', 'eu-west-1');
        await context.prepareStateBucket(basePathForScenario + '../state.json');
        const command = context.command;

        await UpdateOrganizationCommand.Perform({ ...command, templateFile: basePathForScenario + 'organization.yml' });

        await ValidateTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-deploy-stacks-custom-roles.yml', failedTasksTolerance: 99 })

        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-deploy-stacks-custom-roles.yml' });
        const responseAfterUpdate = await cfnClient.send(new DescribeStacksCommand({ StackName: 'integration-test-custom-role' }));
        stackAfterUpdateWithCustomRole = responseAfterUpdate.Stacks[0];

        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '2-cleanup-stacks-custom-roles.yml', performCleanup: true });
        await sleepForTest(200);
        listStacksResponseAfterCleanup = await cfnClient.send(new ListStacksCommand({ StackStatusFilter: ['CREATE_COMPLETE'] }));

    });

    test('custom role was used to deploy stack in target account', () => {
        expect(stackAfterUpdateWithCustomRole).toBeDefined();
        expect(stackAfterUpdateWithCustomRole.RoleARN).toEqual(expect.stringContaining('MyCloudFormationRole'));
        expect(stackAfterUpdateWithCustomRole.StackStatus).toBe('CREATE_COMPLETE');
    });

    test('cleanup will remove stack', () => {
        expect(listStacksResponseAfterCleanup).toBeDefined();
        expect(listStacksResponseAfterCleanup.StackSummaries).toBeDefined();
        const found = listStacksResponseAfterCleanup.StackSummaries.find(x => x.StackName === 'integration-test-custom-role');
        expect(found).toBeUndefined();
    });

    afterAll(async () => {
        await baseAfterAll(context);
    });
});