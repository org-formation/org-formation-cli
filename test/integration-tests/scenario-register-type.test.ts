import { PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, sleepForTest } from './base-integration-test';
import { GetObjectCommand, GetObjectCommandOutput } from '@aws-sdk/client-s3';
import { DeleteStackCommand, DescribeStacksCommand, DescribeStacksCommandOutput, ListTypeVersionsCommand, ListTypeVersionsCommandOutput } from '@aws-sdk/client-cloudformation';

const basePathForScenario = './test/integration-tests/resources/scenario-register-type/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;
    let typesAfterRegister: ListTypeVersionsCommandOutput;
    let typesAfterSecondRegister: ListTypeVersionsCommandOutput;
    let typesAfterThirdRegister: ListTypeVersionsCommandOutput;
    let typesAfterMoveTypesToInclude: ListTypeVersionsCommandOutput;
    let typesAfterCleanup: ListTypeVersionsCommandOutput;
    let stateAfterRegister: string;
    let stateAfterThirdRegister: string;
    let stateAfterMoveTypesToInclude: string;
    let stateAfterCleanup: string;
    let describeStacksOutput: DescribeStacksCommandOutput;

    beforeAll(async () => {
        context = await baseBeforeAll();

        try {
            await context.cfnClient.send(new DeleteStackCommand({ StackName: 'community-servicequotas-s3-resource-role' }));
        } catch {

        }

        await context.prepareStateBucket(basePathForScenario + '../state.json');
        const { command, stateBucketName, s3client, cfnClient } = context;

        await ValidateTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-register-type.yml' });
        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-register-type.yml' });
        typesAfterRegister = await cfnClient.send(new ListTypeVersionsCommand({ Type: 'RESOURCE', TypeName: 'Community::ServiceQuotas::S3' }));
        describeStacksOutput = await cfnClient.send(new DescribeStacksCommand({ StackName: 'community-servicequotas-s3-resource-role' }));


        await sleepForTest(1000);
        const stateAfterRegisterResponse = await s3client.send(new GetObjectCommand({ Bucket: stateBucketName, Key: command.stateObject }));
        stateAfterRegister = await stateAfterRegisterResponse.Body.transformToString('utf-8')

        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '2-register-type-changed-org.yml' });
        typesAfterSecondRegister = await cfnClient.send(new ListTypeVersionsCommand({ Type: 'RESOURCE', TypeName: 'Community::ServiceQuotas::S3' }));

        await sleepForTest(1000);

        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '3-register-type-added-account.yml' });
        typesAfterThirdRegister = await cfnClient.send(new ListTypeVersionsCommand({ Type: 'RESOURCE', TypeName: 'Community::ServiceQuotas::S3' }));

        await sleepForTest(1000);
        const stateAfterThirdRegisterResponse = await s3client.send(new GetObjectCommand({ Bucket: stateBucketName, Key: command.stateObject }));
        stateAfterThirdRegister = await stateAfterThirdRegisterResponse.Body.transformToString('utf-8')

        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '4-move-register-type-to-include.yml', performCleanup: true });
        typesAfterMoveTypesToInclude = await cfnClient.send(new ListTypeVersionsCommand({ Type: 'RESOURCE', TypeName: 'Community::ServiceQuotas::S3' }));

        await sleepForTest(1000);
        const stateAfterMoveTypesToIncludeResponse = await s3client.send(new GetObjectCommand({ Bucket: stateBucketName, Key: command.stateObject }));
        stateAfterMoveTypesToInclude = await stateAfterMoveTypesToIncludeResponse.Body.transformToString('utf-8')

        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '9-cleanup.yml', performCleanup: true });
        typesAfterCleanup = await cfnClient.send(new ListTypeVersionsCommand({ Type: 'RESOURCE', TypeName: 'Community::ServiceQuotas::S3' }));
        const stateAfterCleanupResponse = await s3client.send(new GetObjectCommand({ Bucket: stateBucketName, Key: command.stateObject }));
        stateAfterCleanup = await stateAfterCleanupResponse.Body.transformToString('utf-8')

    });

    test('types after register contains registered type', () => {
        const foundType = typesAfterRegister.TypeVersionSummaries.find(x => x.TypeName === 'Community::ServiceQuotas::S3');
        expect(foundType).toBeDefined();
    });

    test('state after register contains targets', async () => {
        const state = JSON.parse(stateAfterRegister);
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

    test('resource role is deployed when deploying resource provider', async () => {
        const state = JSON.parse(stateAfterRegister);
        expect(state).toBeDefined();
        expect(state.trackedTasks).toBeDefined();
        expect(state.trackedTasks.default).toBeDefined();
        expect(state.trackedTasks.default[0]).toBeDefined();
        expect(state.trackedTasks.default[0].logicalName).toBe('RegisterType');
        expect(state.trackedTasks.default[0].type).toBe('register-type');
        expect(state.trackedTasks.default[0].physicalIdForCleanup).toBe('Community::ServiceQuotas::S3');
    })



    test('state after adding account to organization ', async () => {
        const state = JSON.parse(stateAfterThirdRegister);
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

    test('physical id of type doesnt change after move to include', async () => {
        const stateAfterRegister = JSON.parse(stateAfterThirdRegister);
        const stringifiedTrackedTasksAfterRegister = JSON.stringify(stateAfterRegister.trackedTasks);

        const stateAfterMove = JSON.parse(stateAfterMoveTypesToInclude);
        const stringifiedTrackedTasksAfterMove = JSON.stringify(stateAfterMove.trackedTasks);

        expect(stringifiedTrackedTasksAfterRegister).toBe(stringifiedTrackedTasksAfterMove);
    });


    test('concurrency gets recorded in tracked task', async () => {
        const stateAfterRegister = JSON.parse(stateAfterThirdRegister);

        expect(stateAfterRegister.trackedTasks.default[0].concurrencyForCleanup).toBe(5);
    });

    test('types after cleanup does not contain registered type', () => {
        const foundType = typesAfterCleanup.TypeVersionSummaries.find(x => x.TypeName === 'Community::ServiceQuotas::S3');
        expect(foundType).toBeUndefined();
    });


    test('state after cleanup does not contain any', async () => {
        const state = JSON.parse(stateAfterCleanup);

        expect(Object.keys(state.targets).length).toBe(0);
    });

    afterAll(async () => {
        await baseAfterAll(context);
        await context.cfnClient.send(new DeleteStackCommand({ StackName: 'community-servicequotas-s3-resource-role' }));
    });
});