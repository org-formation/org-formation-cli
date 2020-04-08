import { ValidateTasksCommand, PerformTasksCommand } from "~commands/index";
import { readFileSync } from "fs";
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll } from "./base-integration-test";
import { DescribeStacksOutput } from "aws-sdk/clients/cloudformation";

const basePathForScenario = './test/integration-tests/resources/scenario-reference-export-as-parameter/';

describe('when importing value from another stack', () => {
    let context: IIntegrationTestContext;
    let describedBucketStack: DescribeStacksOutput;
    let describeBucketRoleStack: DescribeStacksOutput;

    beforeAll(async () => {

        context = await baseBeforeAll();

        await context.prepareStateBucket(basePathForScenario + '0-state.json');
        const { command, cfnClient } = context;

        await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-tasks-with-copy-value.yml' })
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-tasks-with-copy-value.yml' });

        describedBucketStack = await cfnClient.describeStacks({StackName: 'scenario-export-bucket'}).promise();
        describeBucketRoleStack = await cfnClient.describeStacks({StackName: 'scenario-export-bucket-role'}).promise();

        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '2-cleanup-tasks-with-copy-value.yml', performCleanup: true });
        const stacksAfterCleanup = await cfnClient.listStacks({StackStatusFilter: ['CREATE_COMPLETE', 'UPDATE_COMPLETE']}).promise();
        expect(stacksAfterCleanup.StackSummaries.find(x=>x.StackName === 'scenario-export-bucket')).toBeUndefined();
        expect(stacksAfterCleanup.StackSummaries.find(x=>x.StackName === 'scenario-export-bucket-role')).toBeUndefined();
    });

    test('Stack parameter with CopyValue has value of Output', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'bucketArn');
        const output = describedBucketStack.Stacks[0].Outputs[0];
        expect(output.ExportName).toBe('BucketArn');
        expect(parameter.ParameterValue).toBe(output.OutputValue);
    })

    test('Stack parameter with explicit accountId has value of Output', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'bucketArn2');
        const output = describedBucketStack.Stacks[0].Outputs[0];
        expect(output.ExportName).toBe('BucketArn');
        expect(parameter.ParameterValue).toBe(output.OutputValue);
    })

    test('Stack parameter with explicit accountId and region has value of Output', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'bucketArn3');
        const output = describedBucketStack.Stacks[0].Outputs[0];
        expect(output.ExportName).toBe('BucketArn');
        expect(parameter.ParameterValue).toBe(output.OutputValue);
    })

    afterAll(()=> {
        baseAfterAll(context);
    })
});