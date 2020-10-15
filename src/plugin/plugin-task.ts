import { IBuildTaskPlugin, IBuildTaskPluginCommandArgs } from './plugin';
import { PluginCliCommand } from './plugin-command';
import { IPluginTask } from './plugin-binder';
import { IBuildTaskConfiguration, IBuildTask } from '~build-tasks/build-configuration';
import { IBuildTaskProvider, BuildTaskProvider } from '~build-tasks/build-task-provider';
import { IPerformTasksCommandArgs, RemoveCommand, BaseCliCommand } from '~commands/index';
import { ConsoleUtil } from '~util/console-util';

export class PluginBuildTaskProvider<TBuildTaskConfiguration extends IBuildTaskConfiguration, TCommandArgs extends IBuildTaskPluginCommandArgs, TTask extends IPluginTask> implements IBuildTaskProvider<TBuildTaskConfiguration> {

    constructor(private plugin: IBuildTaskPlugin<TBuildTaskConfiguration, TCommandArgs, TTask> ) {
        this.type = plugin.typeForTask;
    }

    type: string;

    createTask(config: TBuildTaskConfiguration, command: IPerformTasksCommandArgs): IBuildTask {

        const forceDeploy = command.forceDeploy;
        const task: IBuildTask = {
            type: config.Type,
            name: config.LogicalName,
            physicalIdForCleanup: command.logicalNamePrefix + '/' + config.LogicalName,
            skip: typeof config.Skip === 'boolean' ? config.Skip : undefined,
            childTasks: [],
            isDependency: BuildTaskProvider.createIsDependency(config),
            perform: async (): Promise<void> => {
                ConsoleUtil.LogInfo(`Executing: ${config.Type} ${config.LogicalName}.`);

                const commandArgs = this.plugin.convertToCommandArgs(config, command);
                if (commandArgs.maxConcurrent === undefined) {
                    commandArgs.maxConcurrent = 1;
                }
                if (commandArgs.failedTolerance === undefined) {
                    commandArgs.failedTolerance = 0;
                }
                if (typeof config.LogVerbose === 'boolean') {
                    commandArgs.verbose = config.LogVerbose;
                }
                if (typeof forceDeploy === 'boolean') {
                    commandArgs.forceDeploy = forceDeploy;
                }
                if (typeof config.ForceDeploy === 'boolean') {
                    commandArgs.forceDeploy = config.ForceDeploy;
                }
                const pluginCommand = new PluginCliCommand<TCommandArgs, TTask>(this.plugin);
                await pluginCommand.performCommand(commandArgs);
            },
        };

        return task;
    }

    createTaskForPrint(): IBuildTask | undefined {
        return undefined;
    }

    createTaskForValidation(config: TBuildTaskConfiguration, command: IPerformTasksCommandArgs): IBuildTask {
        return {
            type: config.Type,
            name: config.LogicalName,
            skip: typeof config.Skip === 'boolean' ? config.Skip : undefined,
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
            skip: false,
            childTasks: [],
            isDependency: (): boolean => false,
            perform: async (): Promise<void> => {
                if (!command.performCleanup) {
                    let additionalArgs = await BaseCliCommand.CreateAdditionalArgsForInvocation();
                    let namespace: string;
                    let name = physicalId;
                    if (physicalId.indexOf('/') > 0) {
                        namespace = physicalId.substring(0, physicalId.indexOf('/'));
                        name = physicalId.substring(1 + physicalId.indexOf('/'));

                        additionalArgs = '--namespace ' + name + ' ' + additionalArgs;
                    }
                    ConsoleUtil.LogWarning('Hi there, it seems you have removed a task!');
                    ConsoleUtil.LogWarning(`The task was called ${logicalId} and used to deploy a ${this.plugin.type} workload.`);
                    ConsoleUtil.LogWarning('By default these tasks don\'t get cleaned up. You can change this by adding the option --perform-cleanup.');
                    ConsoleUtil.LogWarning('You can remove the project manually by running the following command:');
                    ConsoleUtil.LogWarning('');
                    ConsoleUtil.LogWarning(`    org-formation remove --type ${this.plugin.type} --name ${name} ${additionalArgs}`);
                    ConsoleUtil.LogWarning('');
                    ConsoleUtil.LogWarning('Did you not remove a task? but are you logically using different files? check out the --logical-name option.');

                    for(const target of command.state.enumGenericTargets(this.plugin.type, command.logicalName, namespace, logicalId)) {
                        target.lastCommittedHash = 'deleted';
                        command.state.setGenericTarget(target);
                    }
                } else {
                    ConsoleUtil.LogInfo(`executing: ${this.type} ${logicalId}`);
                    await RemoveCommand.Perform({ ...command,  name: logicalId, type: this.plugin.type, maxConcurrentTasks: 10, failedTasksTolerance: 10 });
                }
            },
        };
    }
}
