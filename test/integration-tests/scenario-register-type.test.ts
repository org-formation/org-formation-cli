import { PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, sleepForTest } from './base-integration-test';
import { ListTypeVersionsOutput, DescribeStacksOutput } from 'aws-sdk/clients/cloudformation';
import { GetObjectOutput } from 'aws-sdk/clients/s3';

const basePathForScenario = './test/integration-tests/resources/scenario-register-type/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;
    let typesAfterRegister: ListTypeVersionsOutput;
    let typesAfterSecondRegister: ListTypeVersionsOutput;
    let typesAfterThirdRegister: ListTypeVersionsOutput;
    let typesAfterMoveTypesToInclude: ListTypeVersionsOutput;
    let typesAfterCleanup: ListTypeVersionsOutput;
    let stateAfterRegister: GetObjectOutput;
    let stateAfterThirdRegister: GetObjectOutput;
    let stateAfterMoveTypesToInclude: GetObjectOutput;
    let stateAfterCleanup: GetObjectOutput;
    let describeStacksOutput: DescribeStacksOutput;

    beforeAll(async () => {
        context = await baseBeforeAll();

        try {
            await context.cfnClient.deleteStack({ StackName: 'community-servicequotas-s3-resource-role' }).promise();
        } catch {

        }

        await context.prepareStateBucket(basePathForScenario + '../state.json');
        const { command, stateBucketName, s3client, cfnClient } = context;

        await ValidateTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-register-type.yml' });
        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-register-type.yml' });
        typesAfterRegister = await cfnClient.listTypeVersions({ Type: 'RESOURCE', TypeName: 'Community::ServiceQuotas::S3' }).promise();
        describeStacksOutput = await cfnClient.describeStacks({ StackName: 'community-servicequotas-s3-resource-role' }).promise();


        await sleepForTest(1000);
        stateAfterRegister = await s3client.getObject({ Bucket: stateBucketName, Key: command.stateObject }).promise();

        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '2-register-type-changed-org.yml' });
        typesAfterSecondRegister = await cfnClient.listTypeVersions({ Type: 'RESOURCE', TypeName: 'Community::ServiceQuotas::S3' }).promise();

        await sleepForTest(1000);

        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '3-register-type-added-account.yml' });
        typesAfterThirdRegister = await cfnClient.listTypeVersions({ Type: 'RESOURCE', TypeName: 'Community::ServiceQuotas::S3' }).promise();

        await sleepForTest(1000);
        stateAfterThirdRegister = await s3client.getObject({ Bucket: stateBucketName, Key: command.stateObject }).promise();

        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '4-move-register-type-to-include.yml', performCleanup: true });
        typesAfterMoveTypesToInclude = await cfnClient.listTypeVersions({ Type: 'RESOURCE', TypeName: 'Community::ServiceQuotas::S3' }).promise();

        await sleepForTest(1000);
        stateAfterMoveTypesToInclude = await s3client.getObject({ Bucket: stateBucketName, Key: command.stateObject }).promise();

        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '9-cleanup.yml', performCleanup: true });
        typesAfterCleanup = await cfnClient.listTypeVersions({ Type: 'RESOURCE', TypeName: 'Community::ServiceQuotas::S3' }).promise();
        stateAfterCleanup = await s3client.getObject({ Bucket: stateBucketName, Key: command.stateObject }).promise();
    });

    test('types after register contains registered type', () => {
        const foundType = typesAfterRegister.TypeVersionSummaries.find(x => x.TypeName === 'Community::ServiceQuotas::S3');
        expect(foundType).toBeDefined();
    });

    test('state after register contains targets', () => {
        const stateAsString = stateAfterRegister.Body.toString();
        const state = JSON.parse(stateAsString);
        expect(state).toBeDefined();
        expect(state.targets).toBeDefined();
        expect(state.targets['register-type']).toBeDefined();
        expect(state.targets['register-type']['default']['default']['RegisterType']).toBeDefined();
        expect(Object.keys(state.targets['register-type']['default']['default']['RegisterType']).length).toBe(2)
        expect(state.targets['register-type']['default']['default']['RegisterType']['102625093955']).toBeDefined();
        expect(state.targets['register-type']['default']['default']['RegisterType']['102625093955']['eu-west-1']).toBeDefined();
        expect(state.targets['register-type']['default']['default']['RegisterType']['340381375986']).toBeDefined();
        expect(state.targets['register-type']['default']['default']['RegisterType']['340381375986']['eu-west-1']).toBeDefined();
    })

    test('state after register contains tracked task', () => {
        expect(describeStacksOutput).toBeDefined();
        expect(describeStacksOutput.Stacks).toBeDefined();
        expect(describeStacksOutput.Stacks[0]).toBeDefined();
        expect(describeStacksOutput.Stacks[0].StackStatus).toBe('CREATE_COMPLETE');
        expect(describeStacksOutput.Stacks[0].Outputs).toBeDefined();
        const executionRole = describeStacksOutput.Stacks[0].Outputs.find(x => x.OutputKey === 'ExecutionRoleArn');
        expect(executionRole).toBeDefined();
    })

    test('resource role is deployed when deploying resource provider', () => {
        const stateAsString = stateAfterRegister.Body.toString();
        const state = JSON.parse(stateAsString);
        expect(state).toBeDefined();
        expect(state.trackedTasks).toBeDefined();
        expect(state.trackedTasks.default).toBeDefined();
        expect(state.trackedTasks.default[0]).toBeDefined();
        expect(state.trackedTasks.default[0].logicalName).toBe('RegisterType');
        expect(state.trackedTasks.default[0].type).toBe('register-type');
        expect(state.trackedTasks.default[0].physicalIdForCleanup).toBe('Community::ServiceQuotas::S3');
    })



    test('state after adding account to organization ', () => {
        const stateAsString = stateAfterThirdRegister.Body.toString();
        const state = JSON.parse(stateAsString);
        expect(state).toBeDefined();
        expect(state.targets).toBeDefined();
        expect(state.targets['register-type']).toBeDefined();
        expect(state.targets['register-type']['default']['default']['RegisterType']).toBeDefined();
        expect(Object.keys(state.targets['register-type']['default']['default']['RegisterType']).length).toBe(3)
        expect(state.targets['register-type']['default']['default']['RegisterType']['102625093955']).toBeDefined();
        expect(state.targets['register-type']['default']['default']['RegisterType']['102625093955']['eu-west-1']).toBeDefined();
        expect(state.targets['register-type']['default']['default']['RegisterType']['340381375986']).toBeDefined();
        expect(state.targets['register-type']['default']['default']['RegisterType']['340381375986']['eu-west-1']).toBeDefined();
        expect(state.targets['register-type']['default']['default']['RegisterType']['549476213961']).toBeDefined();
        expect(state.targets['register-type']['default']['default']['RegisterType']['549476213961']['eu-west-1']).toBeDefined();

    })

    test('type doesnt get updated if only org file changed', () => {
        const foundType1 = typesAfterRegister.TypeVersionSummaries.find(x => x.TypeName === 'Community::ServiceQuotas::S3');
        const foundType2 = typesAfterSecondRegister.TypeVersionSummaries.find(x => x.TypeName === 'Community::ServiceQuotas::S3');
        const foundType3 = typesAfterSecondRegister.TypeVersionSummaries.find(x => x.TypeName === 'Community::ServiceQuotas::S3');
        expect(foundType1.VersionId).toBe(foundType2.VersionId);
        expect(foundType1.VersionId).toBe(foundType3.VersionId);
    });


    test('type continues to be registered after moved to include', () => {
        const foundType1 = typesAfterMoveTypesToInclude.TypeVersionSummaries.find(x => x.TypeName === 'Community::ServiceQuotas::S3');
        expect(foundType1).toBeDefined();
    });

    test('physical id of type doesnt change after move to include', () => {
        const stateAsStringAfterRegister = stateAfterThirdRegister.Body.toString();
        const stateAfterRegister = JSON.parse(stateAsStringAfterRegister);
        const stringifiedTrackedTasksAfterRegister = JSON.stringify(stateAfterRegister.trackedTasks);

        const stateAsStringAfterMove = stateAfterMoveTypesToInclude.Body.toString();
        const stateAfterMove = JSON.parse(stateAsStringAfterMove);
        const stringifiedTrackedTasksAfterMove = JSON.stringify(stateAfterMove.trackedTasks);

        expect(stringifiedTrackedTasksAfterRegister).toBe(stringifiedTrackedTasksAfterMove);
    });


    test('concurrency gets recorded in tracked task', () => {
        const stateAsStringAfterRegister = stateAfterThirdRegister.Body.toString();
        const stateAfterRegister = JSON.parse(stateAsStringAfterRegister);

        expect(stateAfterRegister.trackedTasks.default[0].concurrencyForCleanup).toBe(5);
    });

    test('types after cleanup does not contain registered type', () => {
        const foundType = typesAfterCleanup.TypeVersionSummaries.find(x => x.TypeName === 'Community::ServiceQuotas::S3');
        expect(foundType).toBeUndefined();
    });


    test('state after cleanup does not contain any', () => {
        const stateAsString = stateAfterCleanup.Body.toString();
        const state = JSON.parse(stateAsString);

        expect(Object.keys(state.targets).length).toBe(0);
    });

    afterAll(async () => {
        await baseAfterAll(context);
        await context.cfnClient.deleteStack({ StackName: 'community-servicequotas-s3-resource-role' }).promise();
    });
});