import { PerformTasksCommand, ValidateTasksCommand, CleanupCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, profileForIntegrationTests } from './base-integration-test';
import { readFileSync, writeFileSync } from 'fs';
import { S3 } from 'aws-sdk';
import { CopyToS3TaskPlugin } from '~plugin/impl/s3-copy-build-task-plugin';

const basePathForScenario = './test/integration-tests/resources/scenario-copy-to-s3/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;

     let performCreateOrUpdateMock: jest.SpyInstance;
     let mockAfterInitialUpload: jest.MockContext<any, any>;
     let mockAfterAfterUpdateWithoutChanging: jest.MockContext<any, any>;
     let mockAfterAfterUpdateWithChanging: jest.MockContext<any, any>;

    beforeAll(async () => {
        context = await baseBeforeAll();
        const command = {stateBucketName: context.stateBucketName, stateObject: 'state.json', profile: profileForIntegrationTests, verbose: true, region: 'eu-west-1', performCleanup: true, maxConcurrentStacks: 10, failedStacksTolerance: 0, maxConcurrentTasks: 10, failedTasksTolerance: 0, logicalName: 'default' };

        await context.s3client.createBucket({ Bucket: context.stateBucketName }).promise();
        await context.s3client.upload({ Bucket: command.stateBucketName, Key: command.stateObject, Body: readFileSync(basePathForScenario + 'state.json') }).promise();
        performCreateOrUpdateMock = jest.spyOn(CopyToS3TaskPlugin.prototype, 'performCreateOrUpdate');

        await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-copy-to-s3.yml' });
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-copy-to-s3.yml' });
        mockAfterInitialUpload = performCreateOrUpdateMock.mock;

        performCreateOrUpdateMock.mockReset();
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-copy-to-s3.yml' });
        mockAfterAfterUpdateWithoutChanging = performCreateOrUpdateMock.mock;

        performCreateOrUpdateMock.mockReset();
        writeFileSync(basePathForScenario + 'files/file.txt', Math.random());
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-copy-to-s3.yml' });
        mockAfterAfterUpdateWithChanging = performCreateOrUpdateMock.mock;

    });

    test('perform create or update is called after initial upload', () => {
        expect(mockAfterInitialUpload.calls.length).toBe(1);
    });

    test('perform create or update is not called if file didnt change', () => {
        expect(mockAfterAfterUpdateWithoutChanging.calls.length).toBe(0);
    });

    test('perform create or update is called after file did change', () => {
        expect(mockAfterAfterUpdateWithChanging.calls.length).toBe(1);
    });

    afterAll(async () => {
        await baseAfterAll(context);
    });
});