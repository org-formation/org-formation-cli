import { ConsoleUtil } from '../console-util';
import { OrgFormationError } from '../org-formation-error';
import { ICfnTask } from './cfn-task-provider';

export class CfnTaskRunner {

    public static async RunTasks(tasks: ICfnTask[], stackName: string, alltasks?: ICfnTask[], pendingDependencies?: ICfnTask[]) {
        if (!alltasks) {
            alltasks = tasks;
        }
        if (!pendingDependencies) {
            pendingDependencies = [];
        }
        const runningTasks: Array<Promise<void>> = [];
        for (const task of tasks) {

            if (pendingDependencies.includes(task)) {
                throw new OrgFormationError(`circular dependency on task for target account ${task.accountId} / ${task.region}`);
            }
            const dependentTasks = [];
            if (task.dependentTaskFilter) {
                if (task.dependentTaskFilter(task)) {
                    throw new OrgFormationError(`task has dependency on self target account ${task.accountId} / ${task.region}`);
                }
                dependentTasks.push(...alltasks.filter(task.dependentTaskFilter));
            }
            const needToRunFirst = dependentTasks.filter((x) => !x.done);
            if (needToRunFirst.length > 0) {
                pendingDependencies.push(task);
                await CfnTaskRunner.RunTasks(needToRunFirst, stackName, alltasks, pendingDependencies);
            }
            if (task.done) {
                continue;
            }
            const taskPromise = this.performTask(task).then((x) => ConsoleUtil.LogInfo(`stack ${task.stackName} successfully ${task.action === 'Delete' ? 'deleted from' : 'updated in' } ${task.accountId}/${task.region}.`));
            runningTasks.push(taskPromise);
        }
        ConsoleUtil.LogInfo(`executing stack ${stackName} in ${runningTasks.length} (of ${alltasks.length}) target accounts/regions...`);
        await Promise.all(runningTasks);
    }

    private static async performTask(task: ICfnTask): Promise<void> {
        try {
            await task.perform(task);
            task.done = true;
        } catch (err) {
            ConsoleUtil.LogError(`failed executing stack ${task.stackName} in account ${task.accountId} (${task.region}) \n err: ${err}`);
            // throw err;
        }
    }
}
