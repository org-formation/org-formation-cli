import { ConsoleUtil } from '../util/console-util';
import { OrgFormationError } from '../org-formation-error';
import { GenericTaskRunner, ITaskRunnerDelegates } from '~core/generic-task-runner';
import { IGenericTask } from '~plugin/plugin-binder';

export class DefaultTaskRunner {

    public static async RunTasks(tasks: IGenericTask[], logicalName: string, maxConcurrentTasks: number, failedTasksTolerance: number): Promise<void> {
        if (maxConcurrentTasks === undefined) {
            throw new OrgFormationError('maxConcurrentTasks must not be undefined');
        }
        if (failedTasksTolerance === undefined) {
            throw new OrgFormationError('maxConcurrentTasks must not be undefined');
        }
        const delegate: ITaskRunnerDelegates<IGenericTask> = {
            onTaskRanFailed: (task, err) => {
                ConsoleUtil.LogError(`failed executing task ${task.logicalName} in ${where(task)}. Reason: ${err}`);
            },
            onTaskSkippedBecauseDependencyFailed: task => {
                ConsoleUtil.LogError(`skip executing task ${task.logicalName} in ${where(task)}. Reason: dependency has failed.`);
            },
            onTaskRanSuccessfully: task => {
                const what = task.action === 'Delete' ? 'deleted from' : 'updated in';

                ConsoleUtil.LogInfo(`workload ${task.logicalName} successfully ${what} ${where(task)}.`);
            },
            throwCircularDependency: ts => {
                const targets = ts.map(x => x.accountId + (x.region ? '/' + x.region : ''));
                throw new OrgFormationError(`circular dependency on stack ${logicalName} for targets ${targets.join(', ')}`);
             },
            throwDependencyOnSelfException: task => {throw new OrgFormationError(`stack ${task.logicalName} has dependency on self target account ${where(task)}`); },
            onFailureToleranceExceeded: (totalTasksFailed: number, tolerance: number) => {
                throw new OrgFormationError(`number failed tasks ${totalTasksFailed} exceeded tolerance for failed tasks ${tolerance}`);
            },
            maxConcurrentTasks,
            failedTasksTolerance,
        };
        await GenericTaskRunner.RunTasks<IGenericTask>(tasks, delegate);
    }

}

const where = (task: IGenericTask): string => {
    let result = `${task.accountId}`;
    if (task.region) {
        result = `${result}/${task.region}`;
    }
    return result;
};
