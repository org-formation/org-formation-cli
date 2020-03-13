import { PerformTasksCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, profileForIntegrationTests } from './base-integration-test';
import { readFileSync } from 'fs';
import { ChildProcessUtility } from '~core/child-process-util';
import { GetObjectOutput } from 'aws-sdk/clients/s3';

const basePathForScenario = './test/integration-tests/resources/scenario-serverless-com-task/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;

    let spawnProcessAfterDeployWorkload: jest.MockContext<any, any>;
    let stateAfterDeploy: GetObjectOutput;
    let spawnProcessAfterRemoveWorkload: jest.MockContext<any, any>;
    let stateAfterRemove: GetObjectOutput;
    let spawnProcessMock: jest.SpyInstance;

    beforeAll(async () => {
        spawnProcessMock = jest.spyOn(ChildProcessUtility, 'SpawnProcess');
        context = await baseBeforeAll();
        const command = {stateBucketName: context.stateBucketName, stateObject: 'state.json', profile: profileForIntegrationTests, verbose: true, region: 'eu-west-1', performCleanup: true, maxConcurrentStacks: 10, failedStacksTolerance: 0, maxConcurrentTasks: 10, failedTasksTolerance: 0, logicalName: 'default' };

        await context.s3client.createBucket({ Bucket: context.stateBucketName }).promise();
        await context.s3client.upload({ Bucket: command.stateBucketName, Key: command.stateObject, Body: readFileSync(basePathForScenario + 'state.json') }).promise();

        spawnProcessMock.mockReset();
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-organization-tasks.yml' })
        spawnProcessAfterDeployWorkload = spawnProcessMock.mock;
        stateAfterDeploy = await context.s3client.getObject({Bucket: command.stateBucketName, Key: command.stateObject}).promise();

        spawnProcessMock.mockReset();
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '2-remove-organization-tasks.yml' })
        spawnProcessAfterRemoveWorkload = spawnProcessMock.mock;
        stateAfterRemove = await context.s3client.getObject({Bucket: command.stateBucketName, Key: command.stateObject}).promise();
    });

    test('after deploy workload npx sls deploy was called', () => {
        expect(spawnProcessAfterDeployWorkload.calls[0][0]).toEqual(expect.stringContaining('npx sls deploy'));
    });


    test('after deploy workload state contains deployed workload', () => {
        const stateAsString = stateAfterDeploy.Body.toString();
        const state = JSON.parse(stateAsString);
        expect(state).toBeDefined();
        expect(state.targets).toBeDefined();
        expect(state.targets['serverless.com']).toBeDefined();
        expect(state.targets['serverless.com']['ServerlessWorkload']).toBeDefined();
        expect(state.targets['serverless.com']['ServerlessWorkload']['102625093955']).toBeDefined();
        expect(state.targets['serverless.com']['ServerlessWorkload']['102625093955']['no-region']).toBeDefined();
    });

    test('after deploy workload npm i was called', () => {
        expect(spawnProcessAfterDeployWorkload.calls[0][0]).toEqual(expect.stringContaining('npm i'));
    });

    test('after remove workload sls remove was called', () => {
        expect(spawnProcessAfterRemoveWorkload.calls[0][0]).toEqual(expect.stringContaining('npx sls remove'));
    })

    test('after remove workload state does not contain deployed workload', () => {
        const stateAsString = stateAfterRemove.Body.toString();
        const state = JSON.parse(stateAsString);
        expect(state).toBeDefined();
        expect(state.targets).toBeDefined();
        expect(state.targets['serverless.com']).toBeUndefined();
    });

    afterAll(async () => {
        await baseAfterAll(context);
    })

});