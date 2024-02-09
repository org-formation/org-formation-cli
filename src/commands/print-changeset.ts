import { Command } from 'commander';
import { ConsoleUtil } from '../util/console-util';
import { BaseCliCommand, ICommandArgs } from './base-command';
import { TemplateRoot } from '~parser/parser';
import { ChangeSetProvider } from '~change-set/change-set-provider';
import { GlobalState } from '~util/global-state';
import { yamlDump } from '~yaml-cfn/index';

const commandName = 'print-change-set <change-set-name>';
const commandDescription = 'outputs change set details';

export class PrintChangeSetCommand extends BaseCliCommand<IPrintChangeSetCommandArgs> {

    public static async Perform(command: IPrintChangeSetCommandArgs): Promise<void> {
        const x = new PrintChangeSetCommand();
        await x.performCommand(command);
    }

    constructor(command?: Command) {
        super(command, commandName, commandDescription, 'changeSetName');
    }

    public addOptions(command: Command): void {
        super.addOptions(command);
        command.option('--output <output>', 'the serialization format used when printing change set. Either json or yaml.', 'yaml');
    }

    public async performCommand(command: IPrintChangeSetCommandArgs): Promise<void> {
        const changeSetName = command.changeSetName;
        const stateBucketName = await BaseCliCommand.GetStateBucketName(command.stateBucketName);
        const provider = new ChangeSetProvider(stateBucketName);
        const changeSetObj = await provider.getChangeSet(changeSetName);
        if (!changeSetObj) {
            ConsoleUtil.LogError(`change set '${changeSetName}' not found.`);
            return;
        }
        const template = new TemplateRoot(changeSetObj.template, './');
        const state = await this.getState(command);

        GlobalState.Init(state, template);

        const binder = await this.getOrganizationBinder(template, state);
        const tasks = binder.enumBuildTasks();
        const changeSet = ChangeSetProvider.CreateChangeSet(tasks, changeSetName);

        if (command.output === 'json') {
            ConsoleUtil.Out(JSON.stringify(changeSet, null, 2));
        } else {
            ConsoleUtil.Out(yamlDump(changeSet));
        }

    }
}

export interface IPrintChangeSetCommandArgs extends ICommandArgs {
    changeSetName?: string;
    output?: 'json' | 'yaml';
}
