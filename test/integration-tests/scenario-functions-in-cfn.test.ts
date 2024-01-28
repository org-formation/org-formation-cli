import { PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll } from './base-integration-test';
import { DescribeStacksCommand, DescribeStacksCommandOutput } from '@aws-sdk/client-cloudformation';

const basePathForScenario = './test/integration-tests/resources/scenario-functions-in-cfn/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;
    let lambdaUsingReadFile: DescribeStacksCommandOutput;
    let bucketPolicy1: DescribeStacksCommandOutput;
    let bucketPolicy2: DescribeStacksCommandOutput;

    beforeAll(async () => {

        context = await baseBeforeAll();
        await context.prepareStateBucket(basePathForScenario + '../state.json');
        const command = context.command;
        const { cfnClient } = context;

        await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-cfn-with-functions.yml' })
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-cfn-with-functions.yml' });

        lambdaUsingReadFile = await cfnClient.send(new DescribeStacksCommand({StackName: 'lambda-using-read-file'}));
        bucketPolicy1 = await cfnClient.send(new DescribeStacksCommand({StackName: 'bucket-with-policy1'}));
        bucketPolicy2 = await cfnClient.send(new DescribeStacksCommand({StackName: 'bucket-with-policy2'}));

        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '9-cleanup-cfn-with-functions.yml', performCleanup: true });

    });

    test('lambda using read file was deployed successfully', () => {
        expect(lambdaUsingReadFile).toBeDefined();
        expect(lambdaUsingReadFile.Stacks.length).toBe(1);
        expect(lambdaUsingReadFile.Stacks[0]).toBeDefined();
        expect(lambdaUsingReadFile.Stacks[0].StackStatus).toBe('CREATE_COMPLETE');
    });

    test('bucketPolicy using JsonString deployed successfully', () => {
        expect(bucketPolicy1).toBeDefined();
        expect(bucketPolicy1.Stacks.length).toBe(1);
        expect(bucketPolicy1.Stacks[0]).toBeDefined();
        expect(bucketPolicy1.Stacks[0].StackStatus).toBe('CREATE_COMPLETE');
    });

    test('bucketPolicy using JsonString / ReadFile deployed successfully', () => {
        expect(bucketPolicy2).toBeDefined();
        expect(bucketPolicy2.Stacks.length).toBe(1);
        expect(bucketPolicy2.Stacks[0]).toBeDefined();
        expect(bucketPolicy2.Stacks[0].StackStatus).toBe('CREATE_COMPLETE');
    });

    afterAll(async () => {
        await baseAfterAll(context);
    });
});