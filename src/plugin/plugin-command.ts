import md5 from 'md5';
import { DefaultTaskRunner } from '../core/default-task-runner';
import { PluginBinder, IPluginTask } from './plugin-binder';
import { BaseCliCommand } from '~commands/index';
import { IBuildTaskPlugin, IBuildTaskPluginCommandArgs } from '~plugin/plugin';
import { TemplateRoot } from '~parser/parser';
import { ConsoleUtil } from '~util/console-util';

export class PluginCliCommand<TCommandArgs extends IBuildTaskPluginCommandArgs, TTask extends IPluginTask> extends BaseCliCommand<TCommandArgs> {

    constructor(private plugin: IBuildTaskPlugin<any, TCommandArgs, TTask>) {
        super();
    }

    public async performCommand(command: TCommandArgs): Promise<void> {
        this.plugin.validateCommandArgs(command);


        const hash = this.createHash(command, true);
        const task = this.plugin.convertToTask(command, hash);
        task.taskLocalHash = this.createHash(command, false);
        const state = await this.getState(command);
        const template = TemplateRoot.create(command.organizationFile, {}, command.organizationFileHash);
        const binder = new PluginBinder<TTask>(task, command.logicalName, command.logicalNamePrefix, state, template, command.organizationBinding, this.plugin);
        const tasks = binder.enumTasks();

        if (tasks.length === 0) {
            ConsoleUtil.LogInfo(`${this.plugin.type} workload ${command.name} already up to date.`);
        } else {
            try {
                await DefaultTaskRunner.RunTasks(tasks, command.name, command.verbose === true, command.maxConcurrent, command.failedTolerance);
            } finally {
                await state.save();
            }
        }
    }

    public createHash(command: TCommandArgs, includeOrganizationFile: boolean): string {
        const usedInHash = this.plugin.getValuesForEquality(command);
        const allUsedInHash = {
            organizationFileHash: includeOrganizationFile? command.organizationFileHash : 'some-constant',
            taskRoleName: command.taskRoleName,
            ...usedInHash,
        };
        return md5(JSON.stringify(allUsedInHash));
    }
}
