import { PluginCliCommand } from "~plugin/plugin-command";
import { Command } from "commander";
import { IBuildTaskPluginCommandArgs, IBuildTaskPlugin, PluginProvider } from "~plugin/plugin";
import { PersistedState } from "~state/persisted-state";
import { BaseCliCommand } from "~commands/index";
import { PluginBinder } from "~plugin/plugin-binder";
import { DefaultTaskRunner } from "~core/default-task-runner";
import { TemplateRoot } from "~parser/parser";
import { MasterAccountResource, OrgResourceTypes } from "~parser/model";
import { ConsoleUtil } from "~util/console-util";

describe('when executing plugin command', () => {
    let command: PluginCliCommand<any, any>;
    let commanderCommand: Command;
    let subCommanderCommand: Command;
    let getStateStub: jest.SpyInstance;
    let getPluginStub: jest.SpyInstance;
    let runTasksStub: jest.SpyInstance;
    let commandArgs: IBuildTaskPluginCommandArgs;
    let createTemplateStub: jest.SpyInstance;
    let consoleInfoStub: jest.SpyInstance;
    let mockPlugin: IBuildTaskPlugin<any, any, any> = {
        applyGlobally: true,
        performCreateOrUpdate: jest.fn(),
        validateCommandArgs: jest.fn(),
        getValuesForEquality: jest.fn(() => ({att: 'val'})),
        convertToTask:  jest.fn(() => ({name: 'my-task', type: 'my-type'})),
        appendResolvers: jest.fn(),
    } as any;
    let enumBindingsStub: jest.SpyInstance;

    beforeEach(() => {

        commanderCommand = new Command('root');
        command = new PluginCliCommand<any, any>(mockPlugin);
        subCommanderCommand = commanderCommand.commands[0];

        const state = PersistedState.CreateEmpty('123456789012');
        state.setBinding({type: OrgResourceTypes.MasterAccount, logicalId: 'master', physicalId: '123456789012', lastCommittedHash: 'aa'});

        getStateStub = jest.spyOn(BaseCliCommand.prototype, 'getState')
                           .mockReturnValue(Promise.resolve(state));

        getPluginStub = jest.spyOn(PluginProvider, 'GetPlugin')
                            .mockReturnValue(mockPlugin);

        enumBindingsStub = jest.spyOn(PluginBinder.prototype, 'enumBindings');

        runTasksStub = jest.spyOn(DefaultTaskRunner, 'RunTasks');

        consoleInfoStub = jest.spyOn(ConsoleUtil, 'LogInfo').mockImplementation();

        const template = TemplateRoot.createEmpty();
        template.organizationSection.masterAccount = new MasterAccountResource(template, 'master', {Type: OrgResourceTypes.MasterAccount, Properties: { AccountId: '123123123123', AccountName: 'hi there' }});

        createTemplateStub = jest.spyOn(TemplateRoot, 'create').
                                mockReturnValue(template);

        commandArgs = {
            ...subCommanderCommand,
            organizationBinding: { IncludeMasterAccount: true, Region: 'eu-central-1' },
            type: 'my-type',
            name: 'my-task',
            maxConcurrent: 1,
            failedTolerance: 0,
        } as unknown as IBuildTaskPluginCommandArgs;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('arguments are validated by plugin ', async () => {
        await command.performCommand(commandArgs);
        expect(mockPlugin.validateCommandArgs).toBeCalled();
    });

    test('arguments are concerted to task ', async () => {
        await command.performCommand(commandArgs);
        expect(mockPlugin.convertToTask).toBeCalled();
    });
    test('calls getState to get stacks', async () => {
        await command.performCommand(commandArgs);
        expect(getStateStub).toBeCalledTimes(1);
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

    test('default task runner is used to execute tasks', async () => {
        await command.performCommand(commandArgs);
        expect(runTasksStub).toBeCalledTimes(1);
    });

    test('success is logged to info', async () => {
        await command.performCommand(commandArgs);
        expect(consoleInfoStub).toBeCalledWith(expect.stringContaining('workload my-task successfully updated'));
        expect(consoleInfoStub).toBeCalledWith(expect.stringContaining('123456789012'));
    });
});