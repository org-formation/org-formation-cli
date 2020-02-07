import { ConsoleUtil } from '../console-util';
import { GenericTaskRunner, ITaskRunnerDelegates } from '../core/generic-task-runner';
import { OrgFormationError } from '../org-formation-error';
import { IBuildTask } from './build-configuration';

export class BuildRunner {
    public static async RunTasks(tasks: IBuildTask[], maxConcurrentTasks: number = 1, failedTasksTolerance: number = 0) {
        const delegate: ITaskRunnerDelegates<IBuildTask> = {
            onTaskRanFailed: (task, err) => { ConsoleUtil.LogError(`task ${task.name} failed`, err); },
            onTaskRanSuccessfully: (task) => { ConsoleUtil.LogInfo(`task ${task.name} ran successfully`); },
            throwCircularDependency: (ts) => { throw new OrgFormationError(`circular dependency detected with tasks: ${ts.map((t) => t.name).join(', ')}`); },
            throwDependencyOnSelfException: (task) => { throw new OrgFormationError(`task ${task.name} has a dependency on itself.`); },
            onFailureToleranceExceeded: (totalTasksFailed: number, tolerance: number) => {
                throw new OrgFormationError(`number failed tasks ${totalTasksFailed} exceeded tolerance for failed tasks ${tolerance}`);
             },
            maxConcurrentTasks,
            failedTasksTolerance,
        };
        await GenericTaskRunner.RunTasks<IBuildTask>(tasks, delegate);
    }
    public static async RunValidationTasks(tasks: IBuildTask[], maxConcurrentTasks: number = 1, failedTasksTolerance: number = 0) {
        const delegate: ITaskRunnerDelegates<IBuildTask> = {
            onTaskRanFailed: (task, err) => { ConsoleUtil.LogError(`task ${task.name} failed`, err); },
            // tslint:disable-next-line: no-empty
            onTaskRanSuccessfully: () => { },
            throwCircularDependency: (ts) => { throw new OrgFormationError(`circular dependency detected with tasks: ${ts.map((t) => t.name).join(', ')}`); },
            throwDependencyOnSelfException: (task) => { throw new OrgFormationError(`task ${task.name} has a dependency on itself.`); },
            onFailureToleranceExceeded: (totalTasksFailed: number, tolerance: number) => {
                throw new OrgFormationError(`number failed tasks ${totalTasksFailed} exceeded tolerance for failed tasks ${tolerance}`);
             },
            maxConcurrentTasks,
            failedTasksTolerance,
        };
        await GenericTaskRunner.RunTasks<IBuildTask>(tasks, delegate);
    }
}
