import { PerformTasksCommand, ValidateTasksCommand, UpdateOrganizationCommand } from "~commands/index";
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll } from "./base-integration-test";
import { ConsoleUtil } from "~util/console-util";


const basePathForScenario = './test/integration-tests/resources/scenario-task-that-fails/';


describe('when task fails', () => {
    let context: IIntegrationTestContext;
    let errorAfterPerformTasks: Error;
    let errorAfterValidateTasks: Error;
    let consoleErrorSpy: jest.SpyInstance;
    let mockAfterValidation: jest.MockContext<any, any>;
    let mockAfterPerform: jest.MockContext<any, any>;

    beforeAll(async () => {
        consoleErrorSpy = jest.spyOn(ConsoleUtil, 'LogError');
        context = await baseBeforeAll();
        await context.prepareStateBucket(basePathForScenario + 'state.json');
        const command = context.command;

        await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + 'organization.yml'});

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
        expect(mockAfterValidation.calls[0][0]).toEqual(expect.stringContaining('Stack invalid-template'));
        expect(mockAfterValidation.calls[0][0]).toEqual(expect.stringContaining('XX::S3::Bucket'));
        expect(mockAfterValidation.calls[0][0]).toEqual(expect.stringContaining('Unrecognized resource types'));
    });

    test('perform tasks throws error', () => {
        expect(errorAfterPerformTasks).toBeDefined();
    });

    test('perform tasks logs error', () => {
        expect(mockAfterPerform.calls[0][0]).toEqual(expect.stringContaining('error updating CloudFormation stack invalid-template in account'));
        expect(mockAfterPerform.calls[0][0]).toEqual(expect.stringContaining('XX::S3::Bucket'));
        expect(mockAfterPerform.calls[0][0]).toEqual(expect.stringContaining('Unrecognized resource types:'));
    });

    afterAll(async () => {
        await baseAfterAll(context);
    });

});