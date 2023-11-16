import { PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll } from './base-integration-test';
import { ConsoleUtil } from '~util/console-util';
import { GetStackPolicyCommand, GetStackPolicyCommandOutput, ListStacksCommand, ListStacksCommandOutput } from '@aws-sdk/client-cloudformation';

const basePathForScenario = './test/integration-tests/resources/scenario-update-stacks-stack-policy/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;
    let stackPolicy: GetStackPolicyCommandOutput;
    let stackPolicyAfterUpdate: GetStackPolicyCommandOutput;
    let stackPolicyAfterUpdateWithFlagTrue: GetStackPolicyCommandOutput;
    let stackPolicyAfterUpdateWithFlagFalse: GetStackPolicyCommandOutput;
    let stackPolicyAfterUpdateClearingPolicy: GetStackPolicyCommandOutput;
    let listStacksResponseAfterCleanup: ListStacksCommandOutput;
    let errorAfterUpdating: Error;

    beforeAll(async () => {
        jest.spyOn(ConsoleUtil, 'LogError').mockImplementation();
        context = await baseBeforeAll();
        await context.prepareStateBucket(basePathForScenario + '../state.json');
        const command = context.command;
        const { cfnClient } = context;

        await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-stacks-with-stack-policy.yml' })
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '1-deploy-stacks-with-stack-policy.yml' });
        stackPolicy = await cfnClient.send(new GetStackPolicyCommand({StackName: 'test-with-stack-policy'}));
        try {
            await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '2-update-stacks-with-stack-policy.yml' });
        } catch(err) {
            errorAfterUpdating = err;
        }
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '3-update-stack-policy.yml' });
        stackPolicyAfterUpdate = await cfnClient.send(new GetStackPolicyCommand({StackName: 'test-with-stack-policy'}));

        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '4-update-stack-policy-using-flag.yml' });
        stackPolicyAfterUpdateWithFlagTrue = await cfnClient.send(new GetStackPolicyCommand({StackName: 'test-with-stack-policy'}));

        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '5-update-stack-policy-using-flag-false.yml' });
        stackPolicyAfterUpdateWithFlagFalse = await cfnClient.send(new GetStackPolicyCommand({StackName: 'test-with-stack-policy'}));

        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '6-update-stack-policy-clearing-policy.yml' });
        stackPolicyAfterUpdateClearingPolicy = await cfnClient.send(new GetStackPolicyCommand({StackName: 'test-with-stack-policy'}));

        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '9-cleanup-stacks-with-stack-policy.yml', performCleanup: true });
        listStacksResponseAfterCleanup = await cfnClient.send(new ListStacksCommand({StackStatusFilter: ['CREATE_COMPLETE']}));
    });

    test('stack has Stack Policy', () => {
        expect(stackPolicy.StackPolicyBody).toBeDefined();
        expect(stackPolicy.StackPolicyBody).toEqual(expect.stringContaining('Deny'));
        expect(stackPolicy.StackPolicyBody).toEqual(expect.not.stringContaining('Allow'));
    });

    test('error was thrown when updating resources', () => {
        expect(errorAfterUpdating).toBeDefined();
    });

    test('stack Policy can be updated', () => {
        expect(stackPolicyAfterUpdate.StackPolicyBody).toBeDefined();
        expect(stackPolicyAfterUpdate.StackPolicyBody).toEqual(expect.stringContaining('Allow'));
        expect(stackPolicyAfterUpdate.StackPolicyBody).toEqual(expect.not.stringContaining('Deny'));
    });


    test('stack Policy can be updated using flag true', () => {
        expect(stackPolicyAfterUpdateWithFlagTrue.StackPolicyBody).toBeDefined();
        expect(stackPolicyAfterUpdateWithFlagTrue.StackPolicyBody).toEqual(expect.stringContaining('Deny'));
        expect(stackPolicyAfterUpdateWithFlagTrue.StackPolicyBody).toEqual(expect.not.stringContaining('Allow'));
    });

    test('stack Policy can be updated using flag false', () => {
        expect(stackPolicyAfterUpdateWithFlagFalse.StackPolicyBody).toBeDefined();
        expect(stackPolicyAfterUpdateWithFlagFalse.StackPolicyBody).toEqual(expect.stringContaining('Allow'));
        expect(stackPolicyAfterUpdateWithFlagFalse.StackPolicyBody).toEqual(expect.not.stringContaining('Deny'));
    });


    test('stack Policy is set to allow when policy cleared', () => {
        expect(stackPolicyAfterUpdateClearingPolicy.StackPolicyBody).toBeDefined();
        expect(stackPolicyAfterUpdateWithFlagFalse.StackPolicyBody).toEqual(expect.stringContaining('Allow'));
        expect(stackPolicyAfterUpdateWithFlagFalse.StackPolicyBody).toEqual(expect.not.stringContaining('Deny'));
    });

    test('cleanup will remove stack', () => {
        expect(listStacksResponseAfterCleanup).toBeDefined();
        expect(listStacksResponseAfterCleanup.StackSummaries).toBeDefined();
        const found = listStacksResponseAfterCleanup.StackSummaries.find(x=>x.StackName === 'test-with-stack-policy');
        expect(found).toBeUndefined();
    });

    afterAll(async () => {
        await baseAfterAll(context);
    });
});