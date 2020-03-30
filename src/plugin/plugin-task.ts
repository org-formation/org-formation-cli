import { IBuildTaskPlugin, IBuildTaskPluginCommandArgs } from './plugin';
import { PluginCliCommand } from './plugin-command';
import { IPluginTask } from './plugin-binder';
import { IBuildTaskConfiguration, IBuildTask } from '~build-tasks/build-configuration';
import { IBuildTaskProvider, BuildTaskProvider } from '~build-tasks/build-task-provider';
import { IPerformTasksCommandArgs, CleanupCommand } from '~commands/index';
import { ConsoleUtil } from '~util/console-util';

export class PluginBuildTaskProvider<TBuildTaskConfiguration extends IBuildTaskConfiguration, TCommandArgs extends IBuildTaskPluginCommandArgs, TTask extends IPluginTask> implements IBuildTaskProvider<TBuildTaskConfiguration> {

    constructor(private plugin: IBuildTaskPlugin<TBuildTaskConfiguration, TCommandArgs, TTask> ) {
        this.type = plugin.typeForTask;
    }

    type: string;

    createTask(config: TBuildTaskConfiguration, command: IPerformTasksCommandArgs): IBuildTask {

        return {
            type: config.Type,
            name: config.LogicalName,
            physicalIdForCleanup: config.LogicalName,
            childTasks: [],
            isDependency: BuildTaskProvider.createIsDependency(config),
            perform: async (): Promise<void> => {
                ConsoleUtil.LogInfo(`executing: ${config.Type} ${config.LogicalName}`);

                const commandArgs = this.plugin.convertToCommandArgs(config, command);
                const pluginCommand = new PluginCliCommand<TCommandArgs, TTask>(this.plugin);
                await pluginCommand.performCommand(commandArgs);
            },
        };
    }

    createTaskForValidation(config: TBuildTaskConfiguration, command: IPerformTasksCommandArgs): IBuildTask {
        return {
            type: config.Type,
            name: config.LogicalName,
            childTasks: [],
            isDependency: (): boolean => false,
            perform: async (): Promise<void> => {
                const commandArgs = this.plugin.convertToCommandArgs(config, command);
                this.plugin.validateCommandArgs(commandArgs);
            },
        };
    }

    createTaskForCleanup(logicalId: string, physicalId: string, command: IPerformTasksCommandArgs): IBuildTask {
        return {
            type: 'cleanup-' + this.type,
            name: logicalId,
            childTasks: [],
            isDependency: (): boolean => false,
            perform: async (): Promise<void> => {
                if (!command.performCleanup) {
                    ConsoleUtil.LogWarning('Hi there, it seems you have removed a task!');
                    ConsoleUtil.LogWarning(`The task was called ${logicalId} and used to deploy a ${this.plugin.type} workload.`);
                    ConsoleUtil.LogWarning('By default these tasks dont get cleaned up. You can change this by adding the option --perfom-cleanup.');
                    ConsoleUtil.LogWarning('You can remove the project manually by running the following command:');
                    ConsoleUtil.LogWarning('');
                    ConsoleUtil.LogWarning(`    org-formation cleanup --type ${this.plugin.type} --name ${logicalId}`);
                    ConsoleUtil.LogWarning('');
                    ConsoleUtil.LogWarning('Did you not remove a task? but are you logically using different files? check out the --logical-name option.');
                } else {
                    ConsoleUtil.LogInfo(`executing: ${this.type} ${logicalId}`);
                    await CleanupCommand.Perform({ ...command,  name: logicalId, type: this.plugin.type, maxConcurrentTasks: 10, failedTasksTolerance: 10 });
                }
            },
        };
    }
}
