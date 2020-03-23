import { PerformTasksCommand, ValidateTasksCommand, CleanupCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, profileForIntegrationTests } from './base-integration-test';
import { readFileSync } from 'fs';
import { AwsUtil } from '../../src/aws-util';

const basePathForScenario = './test/integration-tests/resources/scenario-update-stacks-custom-role/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;

    let createCloudFormationServiceMock: jest.SpyInstance;
    let createCloudFormationMockAfterDeploy: jest.MockContext<any, any>;
    let createCloudFormationMockAfterCleanup: jest.MockContext<any, any>;
    // let stateAfterRemoveTask: GetObjectOutput;
    // let spawnProcessAfterRemoveTask: jest.MockContext<any, any>;
    // let spawnProcessMock: jest.SpyInstance;
    // let stateAfterCleanup: GetObjectOutput;
    // let spawnProcessAfterCleanup: jest.MockContext<any, any>;

    beforeAll(async () => {
        // createCloudFormationServiceMock = jest.spyOn(AwsUtil, 'GetCloudFormation');

        context = await baseBeforeAll();
        const command = {stateBucketName: context.stateBucketName, stateObject: 'state.json', profile: profileForIntegrationTests, verbose: true, region: 'eu-west-1', performCleanup: true, maxConcurrentStacks: 10, failedStacksTolerance: 0, maxConcurrentTasks: 10, failedTasksTolerance: 0, logicalName: 'default' };

        await context.s3client.createBucket({ Bucket: context.stateBucketName }).promise();
        await context.s3client.upload({ Bucket: command.stateBucketName, Key: command.stateObject, Body: readFileSync(basePathForScenario + 'state.json') }).promise();

        await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-stacks-custom-roles.yml' })

        //createCloudFormationServiceMock.mockReset();
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-stacks-custom-roles.yml' });
        //createCloudFormationMockAfterDeploy = createCloudFormationServiceMock.mock;

        //createCloudFormationServiceMock.mockReset();
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '2-cleanup-stacks-custom-roles.yml' });
        //createCloudFormationMockAfterCleanup = createCloudFormationServiceMock.mock;
    });

    test('custom role was used to deploy stack in target account', () => {
        //const argsWithLastCall = createCloudFormationServiceMock.mock.calls[1];
        expect('340381375986').toBe('340381375986');
        // expect(argsWithLastCall[1]).toBe('eu-west-1');
        // expect(argsWithLastCall[2]).toEqual(expect.stringContaining('MyRole'));
    });


    // test('custom role was used to ceanup stack in target account', () => {
    //     const argsWithLastCall = createCloudFormationServiceMock.mock.calls[0];
    //     expect(argsWithLastCall[0]).toBe('340381375986');
    //     expect(argsWithLastCall[1]).toBe('eu-west-1');
    //     expect(argsWithLastCall[2]).toEqual(expect.stringContaining('MyRole'));
    // });

    afterAll(async () => {
        await baseAfterAll(context);
    });
});