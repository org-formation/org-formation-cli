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
            getName: task => `Workload ${task.logicalName} in ${task.accountId}/${task.region}`,
            getVerb: task => `${task.action === 'Delete' ? 'deleted' : 'updated'}`,
            maxConcurrentTasks,
            failedTasksTolerance,
        };
        await GenericTaskRunner.RunTasks<IGenericTask>(tasks, delegate);
    }
}
