import { PerformTasksCommand, ValidateTasksCommand, RemoveCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, profileForIntegrationTests, sleepForTest } from './base-integration-test';

import { ChildProcessUtility } from '~util/child-process-util';
import { GetObjectOutput } from 'aws-sdk/clients/s3';

const basePathForScenario = './test/integration-tests/resources/scenario-serverless-com-task/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;

    let spawnProcessAfterDeploy2Targets: jest.MockContext<any, any>;
    let stateAfterDeploy2Targets: GetObjectOutput;
    let spawnProcessAfterDeploy1Target: jest.MockContext<any, any>;
    let stateAfterDeploy1Target: GetObjectOutput;
    let spawnProcessAfterRerunFileWithoutChanges: jest.MockContext<any, any>;
    let spawnProcessAfterRerunFileWithForceDeploy: jest.MockContext<any, any>;
    let spawnProcessAfterUpdateWithParams: jest.MockContext<any, any>;
    let stateAfterUpdateWithParams: GetObjectOutput;
    let stateAfterRemoveTask: GetObjectOutput;
    let spawnProcessAfterRemoveTask: jest.MockContext<any, any>;
    let spawnProcessMock: jest.SpyInstance;
    let stateAfterCleanup: GetObjectOutput;
    let spawnProcessAfterCleanup: jest.MockContext<any, any>;

    beforeAll(async () => {
        spawnProcessMock = jest.spyOn(ChildProcessUtility, 'SpawnProcess');
        context = await baseBeforeAll();
        await context.prepareStateBucket(basePathForScenario + '../state.json');
        const { command, stateBucketName, s3client} = context;

        await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-serverless-workload-2targets.yml' })

        spawnProcessMock.mockReset();
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-serverless-workload-2targets.yml' });
        spawnProcessAfterDeploy2Targets = spawnProcessMock.mock;
        stateAfterDeploy2Targets = await s3client.getObject({Bucket: stateBucketName, Key: command.stateObject}).promise();
        spawnProcessMock = jest.spyOn(ChildProcessUtility, 'SpawnProcess');

        spawnProcessMock.mockReset();
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-serverless-workload-2targets.yml' });
        spawnProcessAfterRerunFileWithoutChanges = spawnProcessMock.mock;

        spawnProcessMock.mockReset();
        await PerformTasksCommand.Perform({...command, forceDeploy: true, tasksFile: basePathForScenario + '1-deploy-serverless-workload-2targets.yml' });
        spawnProcessAfterRerunFileWithForceDeploy = spawnProcessMock.mock;

        spawnProcessMock.mockReset();
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '2-update-serverless-workload-with-parameters.yml' })
        spawnProcessAfterUpdateWithParams = spawnProcessMock.mock;
        await sleepForTest(200);
        stateAfterUpdateWithParams = await s3client.getObject({Bucket: stateBucketName, Key: context.command.stateObject}).promise();

        spawnProcessMock.mockReset();
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '3-deploy-serverless-workload-1target.yml' })
        spawnProcessAfterDeploy1Target = spawnProcessMock.mock;
        await sleepForTest(200);
        stateAfterDeploy1Target = await s3client.getObject({Bucket: stateBucketName, Key: context.command.stateObject}).promise();

        spawnProcessMock.mockReset();
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '4-remove-serverless-workload-task.yml', performCleanup: false })
        spawnProcessAfterRemoveTask = spawnProcessMock.mock;
        await sleepForTest(200);
        stateAfterRemoveTask = await s3client.getObject({Bucket: stateBucketName, Key: context.command.stateObject}).promise();

        spawnProcessMock.mockReset();
        await RemoveCommand.Perform({...command, type: 'serverless.com', name: 'ServerlessWorkload' });
        spawnProcessAfterCleanup = spawnProcessMock.mock;
        stateAfterCleanup = await s3client.getObject({Bucket: stateBucketName, Key: context.command.stateObject}).promise();
    });

    test('after deploy 2 targets npm ci was called twice', () => {
        expect(spawnProcessAfterDeploy2Targets.calls[0][0]).toEqual(expect.stringContaining('npm ci'));
        expect(spawnProcessAfterDeploy2Targets.calls[1][0]).toEqual(expect.stringContaining('npm ci'));
    });

    test('after deploy 2 targets npx sls deploy was called twice', () => {
        expect(spawnProcessAfterDeploy2Targets.calls[0][0]).toEqual(expect.stringContaining('npx sls deploy'));
        expect(spawnProcessAfterDeploy2Targets.calls[1][0]).toEqual(expect.stringContaining('npx sls deploy'));
    });

    test('after deploy 2 targets region is passed to sls deploy command', () => {
        expect(spawnProcessAfterDeploy2Targets.calls[0][0]).toEqual(expect.stringContaining('--region eu-central-1'));
        expect(spawnProcessAfterDeploy2Targets.calls[1][0]).toEqual(expect.stringContaining('--region eu-central-1'));
    });

    test('after deploy 2 targets state contains both deployed workload', () => {
        const stateAsString = stateAfterDeploy2Targets.Body.toString();
        const state = JSON.parse(stateAsString);
        expect(state).toBeDefined();
        expect(state.targets).toBeDefined();
        expect(state.targets['serverless.com']).toBeDefined();
        expect(state.targets['serverless.com']['default']['default']['ServerlessWorkload']).toBeDefined();
        expect(state.targets['serverless.com']['default']['default']['ServerlessWorkload']['102625093955']).toBeDefined();
        expect(state.targets['serverless.com']['default']['default']['ServerlessWorkload']['102625093955']['eu-central-1']).toBeDefined();
        expect(state.targets['serverless.com']['default']['default']['ServerlessWorkload']['340381375986']).toBeDefined();
        expect(state.targets['serverless.com']['default']['default']['ServerlessWorkload']['340381375986']['eu-central-1']).toBeDefined();
    });

    // test('after deploy workload state contains tracked task', () => {
    //     const stateAsString = stateAfterDeploy2Targets.Body.toString();
    //     const state = JSON.parse(stateAsString);
    //     expect(state).toBeDefined();
    //     expect(state.trackedTasks).toBeDefined();
    // });

    test('after updating workload with params', () => {
        const command0 = spawnProcessAfterUpdateWithParams.calls[0][0];
        const command1 = spawnProcessAfterUpdateWithParams.calls[1][0];
        expect(command0).toEqual(expect.stringContaining('--param2 "Account A'));
        expect(command0 !== command1).toBeTruthy();
    });


    test('after rerunning same serverless com task without changing, nothing got executed', () => {
        expect(spawnProcessAfterRerunFileWithoutChanges.calls.length).toEqual(0);
    });

    test('after rerunning same serverless com task without changing and force deploy, both targets get deployed', () => {
        expect(spawnProcessAfterRerunFileWithForceDeploy.calls.length).toEqual(2);
        expect(spawnProcessAfterDeploy2Targets.calls[0][0]).toEqual(expect.stringContaining('--region eu-central-1'));
        expect(spawnProcessAfterDeploy2Targets.calls[1][0]).toEqual(expect.stringContaining('--region eu-central-1'));
    });

    test('after deploy 1 targets sls remove was called', () => {
        expect(spawnProcessAfterDeploy1Target.calls.length).toBe(1);
        expect(spawnProcessAfterDeploy1Target.calls[0][0]).toEqual(expect.stringContaining('npx sls remove'));
    })

    test('sls remove contains region parameter', () => {
        expect(spawnProcessAfterDeploy1Target.calls.length).toBe(1);
        expect(spawnProcessAfterDeploy1Target.calls[0][0]).toEqual(expect.stringContaining('--region eu-central-1'));
    })

    test('after deploy 1 targets state does not contain removed target workload', () => {
        const stateAsString = stateAfterDeploy1Target.Body.toString();
        const state = JSON.parse(stateAsString);
        expect(state).toBeDefined();
        expect(state.targets).toBeDefined();
        expect(state.targets['serverless.com']['default']['default']['ServerlessWorkload']['102625093955']).toBeUndefined();
    });

    test('after removing task sls remove was not called', () => {
        expect(spawnProcessAfterRemoveTask.calls.length).toBe(0);
    })

    test('after removing task state does contain removed target workload', () => {
        const stateAsString = stateAfterRemoveTask.Body.toString();
        const state = JSON.parse(stateAsString);
        expect(state).toBeDefined();
        expect(state.targets).toBeDefined();
        expect(state.targets['serverless.com']).toBeDefined();
    });

    test('after cleanup sls remove was called', () => {
        expect(spawnProcessAfterCleanup.calls.length).toBe(1);
        expect(spawnProcessAfterCleanup.calls[0][0]).toEqual(expect.stringContaining('npx sls remove'));
    })

    test('after cleanup state does not contain removed target workload', () => {
        const stateAsString = stateAfterCleanup.Body.toString();
        const state = JSON.parse(stateAsString);
        expect(state).toBeDefined();
        expect(state.targets).toBeDefined();
        expect(state.targets['serverless.com']).toBeUndefined();
    });


    afterAll(async () => {
        await baseAfterAll(context);
    });
});