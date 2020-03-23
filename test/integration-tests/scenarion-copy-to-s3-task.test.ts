import { PerformTasksCommand, ValidateTasksCommand, CleanupCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, profileForIntegrationTests } from './base-integration-test';
import { readFileSync } from 'fs';
import { S3 } from 'aws-sdk';

const basePathForScenario = './test/integration-tests/resources/scenario-copy-to-s3/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;

    // let spawnProcessAfterDeploy2Targets: jest.MockContext<any, any>;
    // let stateAfterDeploy2Targets: GetObjectOutput;
    // let spawnProcessAfterDeploy1Target: jest.MockContext<any, any>;
    // let stateAfterDeploy1Target: GetObjectOutput;
    // let spawnProcessAfterRerunFileWithoutChanges: jest.MockContext<any, any>;
    // let stateAfterRemoveTask: GetObjectOutput;
    // let spawnProcessAfterRemoveTask: jest.MockContext<any, any>;
     let putObjectMock: jest.SpyInstance;
    // let stateAfterCleanup: GetObjectOutput;
    // let spawnProcessAfterCleanup: jest.MockContext<any, any>;

    beforeAll(async () => {
        context = await baseBeforeAll();
        const command = {stateBucketName: context.stateBucketName, stateObject: 'state.json', profile: profileForIntegrationTests, verbose: true, region: 'eu-west-1', performCleanup: true, maxConcurrentStacks: 10, failedStacksTolerance: 0, maxConcurrentTasks: 10, failedTasksTolerance: 0, logicalName: 'default' };

        await context.s3client.createBucket({ Bucket: context.stateBucketName }).promise();
        await context.s3client.upload({ Bucket: command.stateBucketName, Key: command.stateObject, Body: readFileSync(basePathForScenario + 'state.json') }).promise();

        await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-copy-to-s3.yml' });
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-copy-to-s3.yml' });
    });

    test('putObject was called', () => {
        expect(true).toEqual(true); //todo
    });

    afterAll(async () => {
        await baseAfterAll(context);
    });
});