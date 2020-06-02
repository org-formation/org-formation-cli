import { PerformTasksCommand, ValidateTasksCommand, RemoveCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll } from './base-integration-test';
import { ChildProcessUtility } from '~util/child-process-util';
import { GetObjectOutput } from 'aws-sdk/clients/s3';
import { ExecOptions } from 'child_process';

const basePathForScenario = './test/integration-tests/resources/scenario-cdk-no-region/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;

    let spawnProcessAfterDeploy: jest.MockContext<any, any>;
    let stateAfterDeploy: GetObjectOutput;
    let spawnProcessMock: jest.SpyInstance;
    let stateAfterCleanup: GetObjectOutput;
    let spawnProcessAfterCleanup: jest.MockContext<any, any>;

    beforeAll(async () => {
        spawnProcessMock = jest.spyOn(ChildProcessUtility, 'SpawnProcess');
        context = await baseBeforeAll();

        await context.prepareStateBucket(basePathForScenario + 'state.json');
        const { command, stateBucketName, s3client } = context;

        await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-cdk-workload-1target.yml' })

        spawnProcessMock.mockReset();
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-cdk-workload-1target.yml' });
        spawnProcessAfterDeploy = spawnProcessMock.mock;
        stateAfterDeploy = await s3client.getObject({Bucket: stateBucketName, Key: command.stateObject}).promise();

        spawnProcessMock.mockReset();
        await RemoveCommand.Perform({...command, type: 'cdk', name: 'CdkWorkload' });
        spawnProcessAfterCleanup = spawnProcessMock.mock;
        stateAfterCleanup = await s3client.getObject({Bucket: stateBucketName, Key: command.stateObject}).promise();
    });

    test('1 workload was deployed', () => {
        expect(spawnProcessAfterDeploy.calls.length).toBe(1)
        expect(spawnProcessAfterDeploy.calls[0][0]).toEqual(expect.stringContaining('npx cdk deploy'));
    });

    test('after deploy 1 region is found in state', () => {
        const stateAsString = stateAfterDeploy.Body.toString();
        const state = JSON.parse(stateAsString);
        expect(state).toBeDefined();
        expect(state.targets).toBeDefined();
        expect(state.targets['cdk']).toBeDefined();
        expect(state.targets['cdk']['default']['default']['CdkWorkload']).toBeDefined();
        expect(state.targets['cdk']['default']['default']['CdkWorkload']['340381375986']).toBeDefined();
        expect(Object.keys(state.targets['cdk']['default']['default']['CdkWorkload']['340381375986']).length).toBe(1);
        expect(state.targets['cdk']['default']['default']['CdkWorkload']['340381375986']['eu-central-1']).toBeDefined();
    });

    afterAll(async () => {
        await baseAfterAll(context);
    });
});