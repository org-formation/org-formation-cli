import { PerformTasksCommand, RemoveCommand, ValidateTasksCommand } from "~commands/index";
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, sleepForTest } from "./base-integration-test";
import { GetObjectOutput } from "aws-sdk/clients/s3";
import { PersistedState } from "~state/persisted-state";
import { CopyToS3TaskPlugin } from "~plugin/impl/s3-copy-build-task-plugin";

const basePathForScenario = './test/integration-tests/resources/scenario-include-file-twice/';


describe('when cleaning up stacks', () => {
    let context: IIntegrationTestContext;
    let stateAfterPerformTask2Includes: GetObjectOutput;
    let stateAfterPerformTask1Includes: GetObjectOutput;
    let stateAfterRemove: GetObjectOutput;
    let performRemoveSpy: jest.SpyInstance;
    let errorValidateIncludeMissingParameter: Error;

    beforeAll(async () => {
        try{
            context = await baseBeforeAll();
            await context.prepareStateBucket(basePathForScenario + '../state.json');
            const { command, stateBucketName, s3client} = context;

            await PerformTasksCommand.Perform({...command, parameters: 'bucketName=' + stateBucketName,  tasksFile: basePathForScenario + '0-organization-tasks.yml', performCleanup: false});
            await sleepForTest(500);
            stateAfterPerformTask2Includes = await s3client.getObject({Bucket: stateBucketName, Key: command.stateObject}).promise();

            await PerformTasksCommand.Perform({...command, parameters: 'bucketName=' + stateBucketName,  tasksFile: basePathForScenario + '0-organization-tasks-1include.yml', performCleanup: false});
            await sleepForTest(500);
            stateAfterPerformTask1Includes = await s3client.getObject({Bucket: stateBucketName, Key: command.stateObject}).promise();

            performRemoveSpy = jest.spyOn(CopyToS3TaskPlugin.prototype, 'performRemove');
            await RemoveCommand.Perform({...command, type: 'copy-to-s3', namespace: 'Include2', name: 'CopyS3File' });
            await sleepForTest(500);
            stateAfterRemove = await s3client.getObject({Bucket: stateBucketName, Key: command.stateObject}).promise();

            try{
                await ValidateTasksCommand.Perform({...command,  tasksFile: basePathForScenario + '1-organization-tasks-missing-param.yml', performCleanup: false});
            }catch(err) {
                errorValidateIncludeMissingParameter = err;
            }
        }
        catch(err) {
            expect(err.message).toBe('');
        }
    });

    test('expect state to contain stacks from both includes', () => {
        const str = stateAfterPerformTask2Includes.Body.toString();
        const obj = JSON.parse(str);
        const state = new PersistedState(obj);
        expect(state).toBeDefined();
        expect(state.getTarget('include1-my-stack-name', '102625093955', 'eu-west-1')).toBeDefined();
        expect(state.getTarget('include2-my-stack-name', '102625093955', 'eu-west-1')).toBeDefined();
        expect(state.getTrackedTasks('default').find(x=>x.physicalIdForCleanup === 'include1-my-stack-name')).toBeDefined();
        expect(state.getTrackedTasks('default').find(x=>x.physicalIdForCleanup === 'include2-my-stack-name')).toBeDefined();
    });

    test('expect state to contain targets for both s3 deploys', () => {
        const str = stateAfterPerformTask2Includes.Body.toString();
        const obj = JSON.parse(str);
        const copyToS3 = obj.targets['copy-to-s3']['default'];
        expect(Object.keys(copyToS3).length).toBe(2);
        expect(copyToS3.Include1).toBeDefined();
        expect(copyToS3.Include2).toBeDefined();

    });

    test('after removing include contained stacks have last committed hash set to deleted', () => {
        const str = stateAfterPerformTask1Includes.Body.toString();
        const obj = JSON.parse(str);
        const state = new PersistedState(obj);
        expect(state).toBeDefined();
        expect(state.getTarget('include1-my-stack-name', '102625093955', 'eu-west-1')).toBeDefined();
        expect(state.getTarget('include2-my-stack-name', '102625093955', 'eu-west-1')).toBeDefined();
        const target = state.getTarget('include2-my-stack-name', '102625093955', 'eu-west-1');
        expect(target.lastCommittedHash).toBe('deleted');
        expect(state.getTrackedTasks('default').find(x=>x.physicalIdForCleanup === 'include1-my-stack-name')).toBeDefined();
        expect(state.getTrackedTasks('default').find(x=>x.physicalIdForCleanup === 'include2-my-stack-name')).toBeUndefined();
    });

    test('after removing previously deleted plugin task performDelete was called', () => {
        expect(performRemoveSpy).toBeCalledTimes(1);
    });

    test('after removing previously deleted plugin state was also removed', () => {
        const str = stateAfterRemove.Body.toString();
        const obj = JSON.parse(str);
        const copyToS3 = obj.targets['copy-to-s3']['default'];
        expect(Object.keys(copyToS3).length).toBe(1);
        expect(copyToS3.Include2).toBeUndefined();
    });

    test('include with missing parameter throws error', () => {
        expect(errorValidateIncludeMissingParameter).toBeDefined();
        expect(errorValidateIncludeMissingParameter.message).toContain('bucketName');
    });

    afterAll(async () => {
        await baseAfterAll(context);
    })
});