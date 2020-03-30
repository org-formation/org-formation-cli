import { PerformTasksCommand, ValidateTasksCommand, CleanupCommand, UpdateOrganizationCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, profileForIntegrationTests } from './base-integration-test';
import { readFileSync } from 'fs';
import { AwsUtil } from '~util/aws-util';
import { CloudFormation } from 'aws-sdk';
import { Stack, ListStacksOutput } from 'aws-sdk/clients/cloudformation';

const basePathForScenario = './test/integration-tests/resources/scenario-update-stacks-custom-role/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;
    let cfnClient: CloudFormation;

    let stackAfterUpdateWithCustomRole: Stack;
    let listStacksResponseAfterCleanup: ListStacksOutput;

    beforeAll(async () => {

        context = await baseBeforeAll();
        cfnClient = await AwsUtil.GetCloudFormation('340381375986', 'eu-west-1');

        const command = {stateBucketName: context.stateBucketName, stateObject: 'state.json', profile: profileForIntegrationTests, verbose: true, region: 'eu-west-1', performCleanup: true, maxConcurrentStacks: 10, failedStacksTolerance: 0, maxConcurrentTasks: 10, failedTasksTolerance: 0, logicalName: 'default' };

        await context.s3client.createBucket({ Bucket: context.stateBucketName }).promise();
        await context.s3client.upload({ Bucket: command.stateBucketName, Key: command.stateObject, Body: readFileSync(basePathForScenario + 'state.json') }).promise();

        await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + 'organization.yml'});

        await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-stacks-custom-roles.yml' })

        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-stacks-custom-roles.yml' });
        const responseAfterUpdate = await cfnClient.describeStacks({StackName: 'integration-test-custom-role'}).promise();
        stackAfterUpdateWithCustomRole = responseAfterUpdate.Stacks[0];

        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '2-cleanup-stacks-custom-roles.yml' });
        listStacksResponseAfterCleanup = await cfnClient.listStacks({StackStatusFilter: ['CREATE_COMPLETE']}).promise();

    });

    test('custom role was used to deploy stack in target account', () => {
        expect(stackAfterUpdateWithCustomRole).toBeDefined();
        expect(stackAfterUpdateWithCustomRole.RoleARN).toEqual(expect.stringContaining('MyCloudFormmationRole'));
        expect(stackAfterUpdateWithCustomRole.StackStatus).toBe('CREATE_COMPLETE');
    });

    test('cleanup will remove stack', () => {
        expect(listStacksResponseAfterCleanup).toBeDefined();
        expect(listStacksResponseAfterCleanup.StackSummaries).toBeDefined();
        const found = listStacksResponseAfterCleanup.StackSummaries.find(x=>x.StackName === 'integration-test-custom-role');
        expect(found).toBeUndefined();
    });

    afterAll(async () => {
        await baseAfterAll(context);
    });
});