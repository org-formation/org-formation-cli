import { Command } from 'commander';
import { BuildConfiguration } from '../build-tasks/build-configuration';
import { BuildRunner } from '../build-tasks/build-runner';
import { BaseCliCommand, ICommandArgs } from './base-command';

const commandName = 'perform-tasks <tasks-file>';
const commandDescription = 'performs all tasks from either a file or directory structure';

export class PerformTasksCommand extends BaseCliCommand<IPerformTasksCommandArgs> {

    constructor(command: Command) {
        super(command, commandName, commandDescription, 'tasksFile');
    }

    public addOptions(command: Command) {
        command.option('--max-concurrent-tasks <max-concurrent-tasks>', 'maximum number of tasks to be executed concurrently', 1);
        command.option('--max-concurrent-stacks <max-concurrent-stacks>', 'maximum number of stacks (within a task) to be executed concurrently', 1);
        command.option('--failed-tasks-tolerance <failed-tasks-tolerance>', 'the number of failed tasks after which execution stops', 0);
        command.option('--failed-stacks-tolerance <failed-stacks-tolerance>', 'the number of failed stacks (within a task) after which execution stops', 0);
        super.addOptions(command);
    }

    public async performCommand(command: IPerformTasksCommandArgs) {
        const tasksFile = command.tasksFile;
        const config = new BuildConfiguration(tasksFile);
        const tasks = config.enumBuildTasks(command);
        await BuildRunner.RunTasks(tasks, command.maxConcurrentTasks, command.failedTasksTolerance);
    }
}

interface IPerformTasksCommandArgs extends ICommandArgs {
    tasksFile: string;
    maxConcurrentTasks: number;
    failedTasksTolerance: number;
    maxConcurrentStacks: number;
    failedStacksTolerance: number;
}
