import { ConsoleUtil } from '../console-util';
import { OrgFormationError } from '../org-formation-error';
import { IBuildTask } from './build-configuration';
import { GenericTaskRunner, ITaskRunnerDelegates } from '~core/generic-task-runner';

export class BuildRunner {
    public static async RunTasks(tasks: IBuildTask[], maxConcurrentTasks = 1, failedTasksTolerance = 0): Promise<void> {
        const delegate: ITaskRunnerDelegates<IBuildTask> = {
            onTaskRanFailed: (task, err) => { ConsoleUtil.LogError(`task ${task.name} failed`, err); },
            onTaskSkippedBecauseDependencyFailed: task => {
                ConsoleUtil.LogError(`task ${task.name} failed, reason: dependency had failed`);
            },
            onTaskRanSuccessfully: task => { ConsoleUtil.LogInfo(`task ${task.name} ran successfully`); },
            throwCircularDependency: ts => { throw new OrgFormationError(`circular dependency detected with tasks: ${ts.map(t => t.name).join(', ')}`); },
            throwDependencyOnSelfException: task => { throw new OrgFormationError(`task ${task.name} has a dependency on itself.`); },
            onFailureToleranceExceeded: (totalTasksFailed: number, tolerance: number) => {
                throw new OrgFormationError(`number failed tasks ${totalTasksFailed} exceeded tolerance for failed tasks ${tolerance}`);
             },
            maxConcurrentTasks,
            failedTasksTolerance,
        };
        await GenericTaskRunner.RunTasks<IBuildTask>(tasks, delegate);
    }
    public static async RunValidationTasks(tasks: IBuildTask[], maxConcurrentTasks = 1, failedTasksTolerance = 0): Promise<void> {
        const delegate: ITaskRunnerDelegates<IBuildTask> = {
            onTaskRanFailed: (task, err) => { ConsoleUtil.LogError(`task ${task.name} failed`, err); },
            onTaskSkippedBecauseDependencyFailed: task => {
                ConsoleUtil.LogError(`task ${task.name} failed, reason: dependency had failed`);
            },
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            onTaskRanSuccessfully: () => { },
            throwCircularDependency: ts => { throw new OrgFormationError(`circular dependency detected with tasks: ${ts.map(t => t.name).join(', ')}`); },
            throwDependencyOnSelfException: task => { throw new OrgFormationError(`task ${task.name} has a dependency on itself.`); },
            onFailureToleranceExceeded: (totalTasksFailed: number, tolerance: number) => {
                throw new OrgFormationError(`number failed tasks ${totalTasksFailed} exceeded tolerance for failed tasks ${tolerance}`);
             },
            maxConcurrentTasks,
            failedTasksTolerance,
        };
        await GenericTaskRunner.RunTasks<IBuildTask>(tasks, delegate);
    }
}
