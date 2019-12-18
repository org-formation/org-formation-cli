import { Command } from 'commander';
import { ConsoleUtil } from '../console-util';
import { TaskRunner } from '../org-binder/org-task-runner';
import { TemplateRoot } from '../parser/parser';
import { BaseCliCommand, ICommandArgs } from './base-command';

const commandName = 'update <templateFile>';
const commandDescription = 'update organization resources';

export class UpdateOrganizationCommand extends BaseCliCommand<IUpdateOrganizationCommandArgs> {

    public static async Perform(command: IUpdateOrganizationCommandArgs) {
        const x = new UpdateOrganizationCommand();
        await x.performCommand(command);
    }

    constructor(command?: Command) {
        super(command, commandName, commandDescription, 'templateFile');
    }

    public addOptions(command: Command) {
        super.addOptions(command);
    }

    public async performCommand(command: IUpdateOrganizationCommandArgs) {
        const template = TemplateRoot.create(command.templateFile);
        const state = await this.getState(command);
        const templateHash = template.hash;

        const lastHash = state.getValue('organization.template.hash');
        if (lastHash === templateHash) {
            ConsoleUtil.LogInfo('organization up to date, no work to be done.');
            return;
        }

        const binder = await this.getOrganizationBinder(template, state);

        const tasks = binder.enumBuildTasks();
        if (tasks.length === 0) {
            ConsoleUtil.LogInfo('organization up to date, no work to be done.');
        } else {
            await TaskRunner.RunTasks(tasks);
            ConsoleUtil.LogInfo('done');
        }
        state.putValue('organization.template.hash', templateHash);
        state.setPreviousTemplate(template.source);
        await state.save();
    }
}

export interface IUpdateOrganizationCommandArgs extends ICommandArgs {
    templateFile: string;
}
