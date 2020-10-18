import { ValidateTasksCommand, PerformTasksCommand } from "~commands/index";
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, sleepForTest } from "./base-integration-test";
import { DescribeStacksOutput, ListStacksOutput } from "aws-sdk/clients/cloudformation";

const basePathForScenario = './test/integration-tests/resources/scenario-cfn-parameter-expressions/';

describe('when importing value from another stack', () => {
    let context: IIntegrationTestContext;
    let describedBucketStack: DescribeStacksOutput;
    let describeBucketRoleStack: DescribeStacksOutput;
    let stacksAfterCleanup: ListStacksOutput;

    beforeAll(async () => {
        try{
            context = await baseBeforeAll();

            await context.prepareStateBucket(basePathForScenario + '../state.json');
            const { command, cfnClient } = context;

            await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-update-stacks-with-param-expressions.yml' })
            await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-update-stacks-with-param-expressions.yml' });

            describedBucketStack = await cfnClient.describeStacks({StackName: 'my-scenario-export-bucket'}).promise();
            describeBucketRoleStack = await cfnClient.describeStacks({StackName: 'my-scenario-export-bucket-role'}).promise();

            await sleepForTest(2000);

            await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '2-cleanup-update-stacks-with-param-expressions.yml', performCleanup: true });
            stacksAfterCleanup = await cfnClient.listStacks({StackStatusFilter: ['CREATE_COMPLETE', 'UPDATE_COMPLETE']}).promise();
        }catch(err) {
            expect(err.message).toBeUndefined();
        }
    });

    test('Stack description is set', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const description = describeBucketRoleStack.Stacks[0].Description;
        expect(description).toBe('something current account "Organizational Master Account" also account by name "Account A"');
    })
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

    test('Stack parameter with arr has value', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'paramArray');
        expect(parameter.ParameterValue).toBe('val1,val2');
    })

    test('Stack parameter with explicit accountId and region has value of Output', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'bucketArn3');
        const output = describedBucketStack.Stacks[0].Outputs[0];
        expect(output.ExportName).toBe('BucketArn');
        expect(parameter.ParameterValue).toBe(output.OutputValue);
    })

    test('Stack parameter with logical account Id and region has value of Output', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'bucketArn4');
        const output = describedBucketStack.Stacks[0].Outputs[0];
        expect(output.ExportName).toBe('BucketArn');
        expect(parameter.ParameterValue).toBe(output.OutputValue);
    })

    test('Stack parameter with !Ref gets resolved ', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'masterAccountId');
        expect(parameter.ParameterValue).toBe('102625093955');
    })

    test('Stack parameter with numeric value gets converted to a string ', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'numericValue');
        expect(parameter.ParameterValue).toBe('123');
    })

    test('Stack parameter with !GetAtt gets resolved ', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'tagVal');
        expect(parameter.ParameterValue).toBe('tag-value');
    })

    test('Stack parameter with !GetAtt and CurrentAccount gets resolved ', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'tagVal2');
        expect(parameter.ParameterValue).toBe('tag-value');
    })

    test('Stack parameter with !GetAtt and AWSAccount gets resolved ', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'tagVal3');
        expect(parameter.ParameterValue).toBe('tag-value');
    })

    test('Stack parameter with !Ref and AWSAccount gets resolved ', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'tagVal4');
        expect(parameter.ParameterValue).toBe('102625093955');
    })

    test('Stack parameter with !Sub gets resolved ', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'someSubExpression');
        expect(parameter.ParameterValue).toBe('--102625093955--102625093955');
    })

    test('Stack parameter Ref on CurrentAccount gets resolved ', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'currentAccount');
        expect(parameter.ParameterValue).toBe('102625093955');
    })

    test('CopyValue within Join gets resolved properly', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'joinedCopyValue');
        const output = describedBucketStack.Stacks[0].Outputs[0];
        expect(output.ExportName).toBe('BucketArn');
        expect(parameter.ParameterValue).toBe(output.OutputValue + '-postfix');
    })

    test('FindInMap gets resolved properly', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'findInMap1');
        expect(parameter.ParameterValue).toBe('MyVal1');
    })

    test('FindInMap with parameter gets resolved properly', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'findInMap1');
        expect(parameter.ParameterValue).toBe('MyVal1');
    })

    test('md5 gets resolved properly', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'md5');
        expect(parameter.ParameterValue).toBe('5377a3405f914e569220a5a65e318f9a');
    })

    test('readFile gets resolved properly', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'readFile');
        expect(parameter.ParameterValue).toBe('contents of file');
    })

    test('md5 and readFile gets resolved properly', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'md5readFile');
        expect(parameter.ParameterValue).toBe('4d06f8349b277ddc4cd33dc192bfccf3');
    })

    test('select gets resolved properly', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'select');
        expect(parameter.ParameterValue).toBe('three');
    })

    test('select combined with find-in-map gets resolved properly', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'selectFindInMap');
        expect(parameter.ParameterValue).toBe('MyVal1');
    })

    test('ref to OrganizationRoot resolves to physical id of root', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'refToRoot');
        expect(parameter.ParameterValue).toBe('r-kvte');
    })

    test('JsonString resolves to minimized json string', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'jsonString1');
        expect(parameter.ParameterValue).toBe('{"att":1,"otherAtt":"2"}');
    })

    test('JsonString can be used with ReadFile', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'jsonString2');
        expect(parameter.ParameterValue).toBe('{"key":"val"}');
    })

    test('ref to orgPrincipalId resolves correctly', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'orgPrincipalId');
        expect(parameter.ParameterValue).toBe('o-82c6hlhsvp');
    })

    test('ref to orgStateBucket resolves correctly', () =>{
        expect(describeBucketRoleStack).toBeDefined();

        const parameter = describeBucketRoleStack.Stacks[0].Parameters.find(x=>x.ParameterKey === 'orgStateBucketName');
        expect(parameter.ParameterValue).toBe(context.stateBucketName);
    })

    test('cleanup removes deployed stacks', () => {
        expect(stacksAfterCleanup.StackSummaries.find(x=>x.StackName === 'my-scenario-export-bucket')).toBeUndefined();
        expect(stacksAfterCleanup.StackSummaries.find(x=>x.StackName === 'my-scenario-export-bucket-role')).toBeUndefined();
    });

    afterAll(async ()=> {
        await baseAfterAll(context);
    })
});