import { PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll } from './base-integration-test';
import { writeFileSync } from 'fs';
import { CopyToS3TaskPlugin } from '~plugin/impl/s3-copy-build-task-plugin';

const basePathForScenario = './test/integration-tests/resources/scenario-copy-to-s3/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;

    let performCreateOrUpdateMock: jest.SpyInstance;
    let mockAfterInitialUpload: jest.MockContext<any, any>;
    let mockAfterAfterUpdateWithoutChanging: jest.MockContext<any, any>;
    let mockAfterAfterUpdateWithChanging: jest.MockContext<any, any>;
    let mockAfterAfterUpdateWithForceDeploy: jest.MockContext<any, any>;
    let copyS3WithTemplateContextContent: string;

    beforeAll(async () => {
        context = await baseBeforeAll();
        
        await context.prepareStateBucket(basePathForScenario + '../state.json');
        const { command } = context;

        performCreateOrUpdateMock = jest.spyOn(CopyToS3TaskPlugin.prototype, 'performCreateOrUpdate');

        await ValidateTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-copy-to-s3.yml' });
        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-copy-to-s3.yml' });
        mockAfterInitialUpload = performCreateOrUpdateMock.mock;

        performCreateOrUpdateMock.mockReset();
        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-copy-to-s3.yml' });
        mockAfterAfterUpdateWithoutChanging = performCreateOrUpdateMock.mock;

        performCreateOrUpdateMock.mockReset();
        writeFileSync(basePathForScenario + 'files/file.txt', Math.random().toString());
        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-copy-to-s3.yml' });
        mockAfterAfterUpdateWithChanging = performCreateOrUpdateMock.mock;

        performCreateOrUpdateMock.mockReset();
        await PerformTasksCommand.Perform({ ...command, forceDeploy: true, tasksFile: basePathForScenario + '1-copy-to-s3.yml' });
        mockAfterAfterUpdateWithForceDeploy = performCreateOrUpdateMock.mock;
    });

    test('perform create or update is called after initial upload', () => {
        expect(mockAfterInitialUpload.calls.length).toBe(5);
    });

    test('perform create or update is called with the right remotePath', () => {
        expect(mockAfterInitialUpload.calls.length).toBe(5);
        const firstCall: any[] = mockAfterInitialUpload.calls;
        const callsWithAccountNumberInRemotePath = firstCall.filter(x => x[0].task.remotePath.includes('102625093955'))
        expect(callsWithAccountNumberInRemotePath.length).toBe(3);

        const callsWithIntegrationTestBucketName = firstCall.filter(x => x[0].task.remotePath.includes('org-formation-integration-test'))
        expect(callsWithIntegrationTestBucketName.length).toBe(5);

        const callsWithZipFile = firstCall.filter(x => x[0].task.remotePath.includes('.zip'))
        expect(callsWithZipFile.length).toBe(1);
    });

    test('perform create or update is not called if file didn\'t change', () => {
        expect(mockAfterAfterUpdateWithoutChanging.calls.length).toBe(0);
    });

    test('perform create or update is called after file did change', () => {
        expect(mockAfterAfterUpdateWithChanging.calls.length).toBe(4);
    });

    test('perform create or update is called when deploy is forced', () => {
        expect(mockAfterAfterUpdateWithForceDeploy.calls.length).toBe(5);
    });

    afterAll(async () => {
        await baseAfterAll(context);
    });
});