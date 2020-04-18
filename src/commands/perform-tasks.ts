import { Command } from 'commander';
import { BaseCliCommand, ICommandArgs } from './base-command';
import { BuildTaskProvider } from '~build-tasks/build-task-provider';
import { ITrackedTask } from '~state/persisted-state';
import { Validator } from '~parser/validator';
import { BuildConfiguration } from '~build-tasks/build-configuration';
import { BuildRunner } from '~build-tasks/build-runner';

const commandName = 'perform-tasks <tasks-file>';
const commandDescription = 'performs all tasks from either a file or directory structure';

export class PerformTasksCommand extends BaseCliCommand<IPerformTasksCommandArgs> {
    static async Perform(command: IPerformTasksCommandArgs): Promise<void> {
        const x = new PerformTasksCommand();
        await x.performCommand(command);
    }

    constructor(command?: Command) {
        super(command, commandName, commandDescription, 'tasksFile');
    }

    public addOptions(command: Command): void {
        command.option('--logical-name <tasks-logical-name>', 'logical name of the tasks file, allows multiple tasks files to be used together with --perform-cleanup action', 'default');
        command.option('--perform-cleanup', 'when set will remove resources created by previous perform-tasks after task is removed from tasks file', false);
        command.option('--max-concurrent-tasks <max-concurrent-tasks>', 'maximum number of tasks to be executed concurrently', 1);
        command.option('--max-concurrent-stacks <max-concurrent-stacks>', 'maximum number of stacks (within a task) to be executed concurrently', 1);
        command.option('--failed-tasks-tolerance <failed-tasks-tolerance>', 'the number of failed tasks after which execution stops', 0);
        command.option('--failed-stacks-tolerance <failed-stacks-tolerance>', 'the number of failed stacks (within a task) after which execution stops', 0);
        command.option('--organization-file [organization-file]', 'organization file used for organization bindings');
        command.option('--parameters [parameters]', 'parameters used when creating build tasks from tasks file');
        super.addOptions(command);
    }

    public async performCommand(command: IPerformTasksCommandArgs): Promise<void> {
        const tasksFile = command.tasksFile;

        Validator.validatePositiveInteger(command.maxConcurrentStacks, 'maxConcurrentStacks');
        Validator.validatePositiveInteger(command.failedStacksTolerance, 'failedStacksTolerance');
        Validator.validatePositiveInteger(command.maxConcurrentTasks, 'maxConcurrentTasks');
        Validator.validatePositiveInteger(command.failedTasksTolerance, 'failedTasksTolerance');

        const parameters = this.parseCfnParameters(command.parameters);
        const config = new BuildConfiguration(tasksFile, parameters);
        const tasks = config.enumBuildTasks(command);
        const state = await this.getState(command);

        await BuildRunner.RunTasks(tasks, command.maxConcurrentTasks, command.failedTasksTolerance);
        const tracked = state.getTrackedTasks(command.logicalName);
        const cleanupTasks = BuildTaskProvider.enumTasksForCleanup(tracked, tasks, command);
        if (cleanupTasks.length > 0) {
            await BuildRunner.RunTasks(cleanupTasks, command.maxConcurrentTasks, 0);
        }
        const tasksToTrack = BuildTaskProvider.recursivelyFilter(tasks, x=> x.physicalIdForCleanup !== undefined);
        const trackedTasks: ITrackedTask[] = tasksToTrack.map(x=> { return {physicalIdForCleanup: x.physicalIdForCleanup, logicalName: x.name, type: x.type  }; });
        state.setTrackedTasks(command.logicalName, trackedTasks);
        state.save();
    }
}

export interface IPerformTasksCommandArgs extends ICommandArgs {
    tasksFile: string;
    logicalName: string;
    performCleanup: boolean;
    maxConcurrentTasks: number;
    failedTasksTolerance: number;
    maxConcurrentStacks: number;
    failedStacksTolerance: number;
    organizationFile?: string;
    organizationFileHash?: string;
    parameters?: string;
}
