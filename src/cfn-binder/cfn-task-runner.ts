import { ConsoleUtil } from '../console-util';
import { GenericTaskRunner, ITaskRunnerDelegates } from '../core/generic-task-runner';
import { OrgFormationError } from '../org-formation-error';
import { ICfnTask } from './cfn-task-provider';

export class CfnTaskRunner {

    public static async RunTasks(tasks: ICfnTask[], stackName: string) {

        const delegate: ITaskRunnerDelegates<ICfnTask> = {
            onTaskRanFailed: (task, err) => {
                ConsoleUtil.LogError(`failed executing stack ${task.stackName} in account ${task.accountId} (${task.region}). Reason: ${err}`);
            },
            onTaskRanSuccessfully: (task) => {
                ConsoleUtil.LogInfo(`stack ${task.stackName} successfully ${task.action === 'Delete' ? 'deleted from' : 'updated in' } ${task.accountId}/${task.region}.`);
            },
            throwCircularDependency: (ts) => {
                const targets = ts.map((x) => x.accountId + '/' + x.region);
                throw new OrgFormationError(`circular dependency on stack ${stackName} for targets ${targets.join(', ')}`);
             },
            throwDependencyOnSelfException: (task) => {throw new OrgFormationError(`stack ${task.stackName} has dependency on self target account ${task.accountId} / ${task.region}`); },
            maxConcurrentTasks: 10,
            failedTasksTolerance: 1,
        };
        await GenericTaskRunner.RunTasks<ICfnTask>(tasks, delegate);
    }

    public static async ValidateTemplates(tasks: ICfnTask[], stackName?: string) {

        const delegate: ITaskRunnerDelegates<ICfnTask> = {
            onTaskRanFailed: (task, err) => {
                const sname = stackName ? `stack ${stackName} ` : '';
                ConsoleUtil.LogError(`unable to validate template for ${sname}account ${task.accountId} (${task.region}). Reason: ${err}`);
            },
            onTaskRanSuccessfully: (task) => {
                const sname = stackName ? `stack ${stackName} ` : '';
                ConsoleUtil.LogInfo(`template for ${sname}account ${task.accountId}/${task.region} valid.`);
            },
            throwCircularDependency: (ts) => {
                const targets = ts.map((x) => x.accountId + '/' + x.region);
                throw new OrgFormationError(`circular dependency for targets ${targets.join(', ')}`);
             },
            throwDependencyOnSelfException: (task) => {throw new OrgFormationError(`template has dependency on self target account ${task.accountId} / ${task.region}`); },
            maxConcurrentTasks: 99,
            failedTasksTolerance: 99,
        };
        await GenericTaskRunner.RunTasks<ICfnTask>(tasks, delegate);
    }
}
