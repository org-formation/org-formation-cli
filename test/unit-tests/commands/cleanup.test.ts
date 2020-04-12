import { Command, Option } from 'commander';
import { RemoveCommand, IRemoveCommandArgs, BaseCliCommand } from '~commands/index';

import { PersistedState } from '~state/persisted-state';
import { PluginProvider, IBuildTaskPlugin } from '~plugin/plugin';
import { PluginBinder } from '~plugin/plugin-binder';
import { DefaultTaskRunner } from '~core/default-task-runner';
import { ConsoleUtil } from '~util/console-util';

describe('when creating cleanup command', () => {
    let command: RemoveCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;

    beforeEach(() => {
        commanderCommand = new Command('root');
        command = new RemoveCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];
    });

    test('cleanup command is created', () => {
        expect(command).toBeDefined();
        expect(subCommanderCommand).toBeDefined();
        expect(subCommanderCommand.name()).toBe('remove');
    });

    test('cleanup command has description', () => {
       expect(subCommanderCommand).toBeDefined();
       expect(subCommanderCommand.description()).toBeDefined();
    });

    test('command has state bucket parameter with correct default', () => {
        const opts: Option[] = subCommanderCommand.options;
        const stateBucketOpt = opts.find((x) => x.long === '--state-bucket-name');
        expect(stateBucketOpt).toBeDefined();
        expect(subCommanderCommand.stateBucketName).toBe('organization-formation-${AWS::AccountId}');
    });

    test('cleanup has name parameter which is required', () => {
        const opts: Option[] = subCommanderCommand.options;
        const stackNameOpt = opts.find((x) => x.long === '--name');
        expect(stackNameOpt).toBeDefined();
        expect(stackNameOpt.required).toBeTruthy();
    });

    test('cleanup has type parameter which is required', () => {
        const opts: Option[] = subCommanderCommand.options;
        const stackNameOpt = opts.find((x) => x.long === '--type');
        expect(stackNameOpt).toBeDefined();
        expect(stackNameOpt.required).toBeTruthy();
    });
});


describe('when executing cleanup command', () => {
    let command: RemoveCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;
    let getStateStub: jest.SpyInstance;
    let getPluginStub: jest.SpyInstance;
    let runTasksStub: jest.SpyInstance;
    let commandArgs: IRemoveCommandArgs;
    let mockPlugin: IBuildTaskPlugin<any, any, any> = {
        performRemove: jest.fn()
    } as any;
    let enumBindingsStub: jest.SpyInstance;
    let consoleInfo: jest.SpyInstance;

    beforeEach(() => {

        commanderCommand = new Command('root');
        command = new RemoveCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];

        const state = PersistedState.CreateEmpty('123456789012');
        state.setGenericTarget( {
            targetType: 'my-type',
            logicalAccountId: 'Account1',
            region: 'eu-central-1',
            accountId: '111111111111',
            logicalName: 'my-task',
            lastCommittedHash: 'aa',
            definition: {
                hello: 'world',
            },
        });

        getStateStub = jest.spyOn(BaseCliCommand.prototype, 'getState')
                           .mockReturnValue(Promise.resolve(state));

        getPluginStub = jest.spyOn(PluginProvider, 'GetPlugin')
                            .mockReturnValue(mockPlugin);

        enumBindingsStub = jest.spyOn(PluginBinder.prototype, 'enumBindings');

        runTasksStub = jest.spyOn(DefaultTaskRunner, 'RunTasks');

        consoleInfo = jest.spyOn(ConsoleUtil, 'LogInfo').mockImplementation();

        commandArgs = {
            ...subCommanderCommand,
            type: 'my-type',
            name: 'my-task',
        } as unknown as IRemoveCommandArgs;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('calls getState to get stacks', async () => {
        await command.performCommand(commandArgs);
        expect(getStateStub).toBeCalledTimes(1);
    });

    test('calls getPlugin to get plugin', async () => {
        await command.performCommand(commandArgs);
        expect(getPluginStub).toBeCalledTimes(1);
        expect(getPluginStub).toBeCalledWith('my-type');
    });

    test('call binder to enum tasks', async () => {
        await command.performCommand(commandArgs);
        expect(enumBindingsStub).toBeCalledTimes(1);
    });

    test('binder has empty task to cleanup with', async () => {
        await command.performCommand(commandArgs);
        const instance = enumBindingsStub.mock.instances[0];
        expect(instance.task.organizationBinding).toBeUndefined();
    });

    test('delete task is called ', async () => {
        await command.performCommand(commandArgs);
        expect(mockPlugin.performRemove).toBeCalled();
    });

    test('default task runner is used to execute tasks', async () => {
        await command.performCommand(commandArgs);
        expect(runTasksStub).toBeCalledTimes(1);
    });

    test('logs success on INFO', async () => {
        await command.performCommand(commandArgs);
        expect(consoleInfo).toBeCalledWith(expect.stringContaining('workload my-task successfully deleted from 111111111111/eu-central-1'));
    });

});