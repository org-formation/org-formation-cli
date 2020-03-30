import { PerformTasksCommand, ValidateTasksCommand } from "~commands/index";
import { readFileSync } from "fs";
import { IIntegrationTestContext, baseBeforeAll, profileForIntegrationTests, baseAfterAll } from "./base-integration-test";
import { ConsoleUtil } from "~util/console-util";


const basePathForScenario = './test/integration-tests/resources/scenario-task-that-fails/';


describe('when cleaning up stacks', () => {
    let context: IIntegrationTestContext;
    let errorAfterPerformTasks: Error;
    let errorAfterValidateTasks: Error;
    let consoleErrorSpy: jest.SpyInstance;
    let mockAfterValidation: jest.MockContext<any, any>;
    let mockAfterPerform: jest.MockContext<any, any>;

    beforeAll(async () => {
        consoleErrorSpy = jest.spyOn(ConsoleUtil, 'LogError');
        context = await baseBeforeAll();
        const command = {stateBucketName: context.stateBucketName, stateObject: 'state.json', profile: profileForIntegrationTests, verbose: true, region: 'eu-west-1', performCleanup: true, maxConcurrentStacks: 10, failedStacksTolerance: 0, maxConcurrentTasks: 10, failedTasksTolerance: 0, logicalName: 'default' };


        await context.s3client.createBucket({ Bucket: context.stateBucketName }).promise();
        await context.s3client.upload({ Bucket: command.stateBucketName, Key: command.stateObject, Body: readFileSync(basePathForScenario + 'state.json') }).promise();


        consoleErrorSpy.mockReset();
        try{
            await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + 'organization-tasks.yml'});
        } catch (err) {
            errorAfterValidateTasks = err;
        }
        mockAfterValidation = consoleErrorSpy.mock;

        consoleErrorSpy.mockReset();
        try{
            await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + 'organization-tasks.yml'});
        } catch (err) {
            errorAfterPerformTasks = err;
        }
        mockAfterPerform = consoleErrorSpy.mock;
    });


    test('validate does not throw error', () => {
        expect(errorAfterValidateTasks).toBeUndefined();
    });

    test('validate logs error', () => {
        expect(mockAfterValidation.calls[0][0]).toEqual(expect.stringContaining('contents is empty'));
    });

    test('perform tasks throws error', () => {
        expect(errorAfterPerformTasks).toBeDefined();
    });

    test('perform tasks logs error', () => {
        expect(mockAfterPerform.calls[0][0]).toEqual(expect.stringContaining('contents is empty'));
    });

    afterAll(async () => {
        await baseAfterAll(context);
    });

});