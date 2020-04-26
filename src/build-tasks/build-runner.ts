import { IBuildTask } from './build-configuration';
import { GenericTaskRunner, ITaskRunnerDelegates } from '~core/generic-task-runner';

export class BuildRunner {
    public static async RunTasks(tasks: IBuildTask[], maxConcurrentTasks = 1, failedTasksTolerance = 0): Promise<void> {
        const delegate: ITaskRunnerDelegates<IBuildTask> = {
            getName: task => `Task ${task.name}`,
            getVerb: () => 'execute',
            maxConcurrentTasks,
            failedTasksTolerance,
        };
        await GenericTaskRunner.RunTasks<IBuildTask>(tasks, delegate);
    }
    public static async RunValidationTasks(tasks: IBuildTask[], maxConcurrentTasks = 1, failedTasksTolerance = 0): Promise<void> {
        const delegate: ITaskRunnerDelegates<IBuildTask> = {
            getName: task => `Task ${task.name}`,
            getVerb: () => 'validated',
            maxConcurrentTasks,
            failedTasksTolerance,
        };
        await GenericTaskRunner.RunTasks<IBuildTask>(tasks, delegate);
    }
}
