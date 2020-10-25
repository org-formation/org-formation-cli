import { PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll } from './base-integration-test';
import { DescribeStacksOutput, GetStackPolicyOutput } from 'aws-sdk/clients/cloudformation';

const basePathForScenario = './test/integration-tests/resources/scenario-functions-in-cfn/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;
    let lambdaUsingReadFile: DescribeStacksOutput;
    let permissionSetWithInlinePolicy1: DescribeStacksOutput;
    let permissionSetWithInlinePolicy2: DescribeStacksOutput;

    beforeAll(async () => {

        context = await baseBeforeAll();
        await context.prepareStateBucket(basePathForScenario + '../state.json');
        const command = context.command;
        const { cfnClient } = context;

        await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-cfn-with-functions.yml' })
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-cfn-with-functions.yml' });

        lambdaUsingReadFile = await cfnClient.describeStacks({StackName: 'lambda-using-read-file'}).promise();
        permissionSetWithInlinePolicy1 = await cfnClient.describeStacks({StackName: 'permission-set-using-json-string-1'}).promise();
        permissionSetWithInlinePolicy2 = await cfnClient.describeStacks({StackName: 'permission-set-using-json-string-2'}).promise();

        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '9-cleanup-cfn-with-functions.yml', performCleanup: true });

    });

    test('lambda using read file was deployed successfully', () => {
        expect(lambdaUsingReadFile).toBeDefined();
        expect(lambdaUsingReadFile.Stacks.length).toBe(1);
        expect(lambdaUsingReadFile.Stacks[0]).toBeDefined();
        expect(lambdaUsingReadFile.Stacks[0].StackStatus).toBe('CREATE_COMPLETE');
    });

    test('permission set using JsonString deployed successfully', () => {
        expect(permissionSetWithInlinePolicy1).toBeDefined();
        expect(permissionSetWithInlinePolicy1.Stacks.length).toBe(1);
        expect(permissionSetWithInlinePolicy1.Stacks[0]).toBeDefined();
        expect(permissionSetWithInlinePolicy1.Stacks[0].StackStatus).toBe('CREATE_COMPLETE');
    });

    test('permission set using JsonString / ReadFile deployed successfully', () => {
        expect(permissionSetWithInlinePolicy2).toBeDefined();
        expect(permissionSetWithInlinePolicy2.Stacks.length).toBe(1);
        expect(permissionSetWithInlinePolicy2.Stacks[0]).toBeDefined();
        expect(permissionSetWithInlinePolicy2.Stacks[0].StackStatus).toBe('CREATE_COMPLETE');
    });

});