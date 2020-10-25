import { IBuildTask } from './build-configuration';
import { GenericTaskRunner, ITaskRunnerDelegates } from '~core/generic-task-runner';

export class BuildRunner {
    public static async RunTasks(tasks: IBuildTask[], logVerbose: boolean, maxConcurrentTasks = 1, failedTasksTolerance = 0): Promise<void> {
        const delegate: ITaskRunnerDelegates<IBuildTask> = {
            getName: task => `Task ${task.name}`,
            getVerb: () => 'execute',
            maxConcurrentTasks,
            failedTasksTolerance,
            logVerbose,
        };
        await GenericTaskRunner.RunTasks<IBuildTask>(tasks, delegate);
    }
    public static async RunPrintTasks(tasks: IBuildTask[], logVerbose: boolean, maxConcurrentTasks = 1, failedTasksTolerance = 0): Promise<void> {
        const delegate: ITaskRunnerDelegates<IBuildTask> = {
            getName: task => `Task ${task.name}`,
            getVerb: () => 'print',
            maxConcurrentTasks,
            failedTasksTolerance,
            logVerbose,
        };
        await GenericTaskRunner.RunTasks<IBuildTask>(tasks, delegate);
    }
    public static async RunValidationTasks(tasks: IBuildTask[], logVerbose: boolean, maxConcurrentTasks = 1, failedTasksTolerance = 0): Promise<void> {
        const delegate: ITaskRunnerDelegates<IBuildTask> = {
            getName: task => `Task ${task.name}`,
            getVerb: () => 'validated',
            maxConcurrentTasks,
            failedTasksTolerance,
            logVerbose,
        };
        await GenericTaskRunner.RunTasks<IBuildTask>(tasks, delegate);
    }
}
