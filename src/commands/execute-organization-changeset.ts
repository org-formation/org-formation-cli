import { Command } from 'commander';
import { ConsoleUtil } from '../util/console-util';
import { BaseCliCommand, ICommandArgs } from './base-command';
import { UpdateOrganizationCommand } from './update-organization';
import { TemplateRoot } from '~parser/parser';
import { ChangeSetProvider } from '~change-set/change-set-provider';
import { GlobalState } from '~util/global-state';

const commandName = 'execute-change-set <change-set-name>';
const commandDescription = 'execute previously created change set';

export class ExecuteChangeSetCommand extends BaseCliCommand<IExecuteChangeSetCommandArgs> {

    constructor(command: Command) {
        super(command, commandName, commandDescription, 'changeSetName');
    }

    public addOptions(command: Command): void {
        super.addOptions(command);
        command.option('--change-set-name [change-set-name]', 'change set name');
    }

    public async performCommand(command: IExecuteChangeSetCommandArgs): Promise<void> {
        const changeSetName = command.changeSetName;
        const stateBucketName = await BaseCliCommand.GetStateBucketName(command.stateBucketName);
        const provider = new ChangeSetProvider(stateBucketName);
        const changeSetObj = await provider.getChangeSet(changeSetName);
        if (!changeSetObj) {
            ConsoleUtil.LogError(`change set '${changeSetName}' not found.`);
            return;
        }
        const template = new TemplateRoot(changeSetObj.template, command.devRole, './');
        const state = await this.getState(command);

        GlobalState.Init(state, template);

        const binder = await this.getOrganizationBinder(template, state);
        const tasks = binder.enumBuildTasks();
        const changeSet = ChangeSetProvider.CreateChangeSet(tasks, changeSetName);
        if (JSON.stringify(changeSet) !== JSON.stringify(changeSetObj.changeSet)) {
            ConsoleUtil.LogError('AWS organization state has changed since creating change set.');
            return;
        }
        await UpdateOrganizationCommand.ExecuteTasks(tasks, state, template.hash, template);
    }
}

export interface IExecuteChangeSetCommandArgs extends ICommandArgs {
    changeSetName: string;
}
