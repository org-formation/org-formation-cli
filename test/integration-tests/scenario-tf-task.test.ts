import { PerformTasksCommand, ValidateTasksCommand, RemoveCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll } from './base-integration-test';
import { ChildProcessUtility } from '~util/child-process-util';
import { GetObjectCommandOutput, GetObjectCommand } from '@aws-sdk/client-s3';

const basePathForScenario = './test/integration-tests/resources/scenario-tf-task/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;

    let spawnProcessMock: jest.SpyInstance;
    let spawnProcessAfterDeploy: jest.MockContext<any, any>;
    let stateAfterDeploy: GetObjectCommandOutput;
    let stateAfterCleanup: GetObjectCommandOutput;
    let spawnProcessAfterCleanup: jest.MockContext<any, any>;

    beforeAll(async () => {
        spawnProcessMock = jest.spyOn(ChildProcessUtility, 'SpawnProcess');
        context = await baseBeforeAll();

        await context.prepareStateBucket(basePathForScenario + '../state.json');
        const { command, stateBucketName, s3client } = context;

        await ValidateTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-deploy-tf-workload.yml' })

        spawnProcessMock.mockReset();
        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-deploy-tf-workload.yml' });
        spawnProcessAfterDeploy = spawnProcessMock.mock;
        stateAfterDeploy = await s3client.send(new GetObjectCommand({ Bucket: stateBucketName, Key: command.stateObject }));

        spawnProcessMock.mockReset();
        await RemoveCommand.Perform({ ...command, type: 'tf', name: 'TfWorkfload' });
        spawnProcessAfterCleanup = spawnProcessMock.mock;
        stateAfterCleanup = await s3client.send(new GetObjectCommand({ Bucket: stateBucketName, Key: command.stateObject }));
    });

    test('after deploy npm ci was called twice', () => {
        expect(spawnProcessAfterDeploy.calls[0][0]).toEqual(expect.stringContaining('terraform init -reconfigure  -backend-config=bucket=my-s3-state-bucket'));
        expect(spawnProcessAfterDeploy.calls[1][0]).toEqual(expect.stringContaining('terraform apply  -var "tfvarforbucketname'));
    });

    test('after deploy state contains tf workload', async () => {
        const stateAsString = await stateAfterDeploy.Body.transformToString('utf-8');
        const state = JSON.parse(stateAsString);
        expect(state).toBeDefined();
        expect(state.targets).toBeDefined();
        expect(state.targets['tf']['default']['default']['TfWorkfload']).toBeDefined();
    });

    test('after cleanup cdk destroy was called', () => {
        expect(spawnProcessAfterCleanup.calls[0][0]).toEqual(expect.stringContaining('terraform init -reconfigure  -backend-config=bucket=my-s3-state-bucket'));
        expect(spawnProcessAfterCleanup.calls[1][0]).toEqual(expect.stringContaining('terraform destroy  -var "tfvarforbucketname'));
    })

    test('after cleanup state does not contain removed target workload', async () => {
        const stateAsString = await stateAfterCleanup.Body.transformToString('utf-8');
        const state = JSON.parse(stateAsString);
        expect(state).toBeDefined();
        expect(state.targets).toBeDefined();
        expect(state.targets['tf']).toBeUndefined();
    });


    afterAll(async () => {
        await baseAfterAll(context);
    });
});