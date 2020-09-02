import { PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, sleepForTest  } from './base-integration-test';
import { ListTypeRegistrationsOutput, ListTypeVersionsOutput } from 'aws-sdk/clients/cloudformation';
import { GetObjectOutput } from 'aws-sdk/clients/s3';

const basePathForScenario = './test/integration-tests/resources/scenario-register-type/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;
    let typesAfterRegister : ListTypeVersionsOutput;
    let typesAfterCleanup : ListTypeVersionsOutput;
    let stateAfterRegister: GetObjectOutput;
    let stateAfterCleanup: GetObjectOutput;

    beforeAll(async () => {
        context = await baseBeforeAll();
        await context.prepareStateBucket(basePathForScenario + '../state.json');
        const { command, stateBucketName, s3client, cfnClient } = context;

        await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-register-type.yml' });
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-register-type.yml' });
        typesAfterRegister = await cfnClient.listTypeVersions({Type : 'RESOURCE', TypeName: 'Community::ServiceQuotas::S3'}).promise();

        await sleepForTest(5000);
        stateAfterRegister = await s3client.getObject({Bucket: stateBucketName, Key: command.stateObject}).promise();

        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '2-cleanup.yml', performCleanup: true});
        typesAfterCleanup = await cfnClient.listTypeVersions({Type : 'RESOURCE', TypeName: 'Community::ServiceQuotas::S3'}).promise();
        stateAfterCleanup = await s3client.getObject({Bucket: stateBucketName, Key: command.stateObject}).promise();
    });

    test('types after register contains registered type', () => {
        const foundType = typesAfterRegister.TypeVersionSummaries.find(x=>x.TypeName === 'Community::ServiceQuotas::S3');
        expect(foundType).toBeDefined();
    });

    test('state after register contains targets', () => {
        const stateAsString = stateAfterRegister.Body.toString();
        const state = JSON.parse(stateAsString);
        expect(state).toBeDefined();
        expect(state.targets).toBeDefined();
        expect(state.targets['register-type']).toBeDefined();
        expect(state.targets['register-type']['default']['default']['RegisterType']).toBeDefined();
        expect(state.targets['register-type']['default']['default']['RegisterType']['102625093955']).toBeDefined();
        expect(state.targets['register-type']['default']['default']['RegisterType']['102625093955']['eu-west-1']).toBeDefined();
        expect(state.targets['register-type']['default']['default']['RegisterType']['340381375986']).toBeDefined();
        expect(state.targets['register-type']['default']['default']['RegisterType']['340381375986']['eu-west-1']).toBeDefined();
    })


    test('state after register contains tracked task', () => {
        const stateAsString = stateAfterRegister.Body.toString();
        const state = JSON.parse(stateAsString);
        expect(state).toBeDefined();
        expect(state.trackedTasks).toBeDefined();
        expect(state.trackedTasks.default).toBeDefined();
        expect(state.trackedTasks.default[0]).toBeDefined();
        expect(state.trackedTasks.default[0].logicalName).toBe('RegisterType');
        expect(state.trackedTasks.default[0].type).toBe('register-type');
        expect(state.trackedTasks.default[0].physicalIdForCleanup).toBe('undefined/RegisterType');
    })

    test('types after cleanup does not contain registered type', () => {
        const foundType = typesAfterCleanup.TypeVersionSummaries.find(x=>x.TypeName === 'Community::ServiceQuotas::S3');
        expect(foundType).toBeUndefined();
    });

    test('state after cleanup does not contain any', () => {
        const stateAsString = stateAfterCleanup.Body.toString();
        const state = JSON.parse(stateAsString);

        expect(Object.keys(state.targets).length).toBe(0);
    });

    afterAll(async () => {
        await baseAfterAll(context);
    });
});