import { OrgFormationError } from '../org-formation-error';
import { ICfnTask } from './cfn-task-provider';
import { GenericTaskRunner, ITaskRunnerDelegates } from '~core/generic-task-runner';

export class CfnTaskRunner {

    public static async RunTasks(tasks: ICfnTask[], stackName: string, maxConcurrentTasks: number, failedTasksTolerance: number): Promise<void> {
        if (maxConcurrentTasks === undefined) {
            throw new OrgFormationError('maxConcurrentTasks must not be undefined');
        }
        if (failedTasksTolerance === undefined) {
            throw new OrgFormationError('maxConcurrentTasks must not be undefined');
        }

        const delegate: ITaskRunnerDelegates<ICfnTask> = {
            getName: task => `Stack ${task.stackName} in account ${task.accountId} (${task.region})`,
            getVerb: task => `${task.action === 'Delete' ? 'delete' : 'update'}`,
            maxConcurrentTasks,
            failedTasksTolerance,
        };
        await GenericTaskRunner.RunTasks<ICfnTask>(tasks, delegate);
    }

    public static async ValidateTemplates(tasks: ICfnTask[]): Promise<void> {

        const delegate: ITaskRunnerDelegates<ICfnTask> = {
            getName: task => `Stack ${task.stackName} in account ${task.accountId} (${task.region})`,
            getVerb: () => 'validate',
            maxConcurrentTasks: 99,
            failedTasksTolerance: 99,
        };
        await GenericTaskRunner.RunTasks<ICfnTask>(tasks, delegate);
    }
}
