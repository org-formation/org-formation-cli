import { bool } from 'aws-sdk/clients/signer';
import { ConsoleUtil } from '../console-util';
import { OrgFormationError } from '../org-formation-error';
import { ICfnTask } from './cfn-task-provider';

export class CfnTaskRunner {

    public static async RunTasks(tasks: ICfnTask[], stackName: string) {
        let totalTasksRan = 0;
        let remainingTasks: ICfnTaskInternal[] = tasks;
        let tasksWithDependencies: ICfnTaskInternal[] = [];
        let runningTasks: Array<Promise<void>> = [];
        do {
            for (const task of remainingTasks) {
                const dependentTasks: ICfnTaskInternal[] = [];
                if (task.dependentTaskFilter) {
                    if (task.dependentTaskFilter(task)) {
                        throw new OrgFormationError(`stack ${task.stackName} has dependency on self target account ${task.accountId} / ${task.region}`);
                    }
                    dependentTasks.push(...remainingTasks.filter(task.dependentTaskFilter));
                }
                const needToRunFirst = dependentTasks.filter((x) => !x.done);
                if (needToRunFirst.length > 0) {
                    tasksWithDependencies.push(task);
                    continue;
                }

                const taskPromise = this.performTask(task).then((x) => {
                    if (task.failed) { return; }
                    ConsoleUtil.LogInfo(`stack ${task.stackName} successfully ${task.action === 'Delete' ? 'deleted from' : 'updated in' } ${task.accountId}/${task.region}.`);
                });
                runningTasks.push(taskPromise);
            }
            if (runningTasks.length === 0 && tasksWithDependencies.length > 0) {
                const targets = tasksWithDependencies.map((x) => x.accountId + '/' + x.region);
                throw new OrgFormationError(`circular dependency on stack ${stackName} for targets ${targets.join(', ')}`);
            }
            ConsoleUtil.LogInfo(`executing stack ${stackName} ${totalTasksRan + runningTasks.length} (of ${tasks.length}) target accounts/regions...`);
            await Promise.all(runningTasks);
            totalTasksRan = totalTasksRan + runningTasks.length;
            runningTasks = [];
            remainingTasks = tasksWithDependencies;
            tasksWithDependencies = [];
        } while (remainingTasks.length > 0);
    }

    private static async performTask(task: ICfnTaskInternal): Promise<void> {
        try {
            task.running = true;
            task.promise  = task.perform(task);
            await task.promise;
            task.done = true;
            task.failed = false;
            task.running = false;
        } catch (err) {
            task.done = true;
            task.failed = true;
            task.running = false;
            ConsoleUtil.LogError(`failed executing stack ${task.stackName} in account ${task.accountId} (${task.region}) \n err: ${err}`);
            // throw err;
        }
    }
}

type ICfnTaskInternal = ICfnTask & ICfnTaskState;

interface ICfnTaskState {
    done?: boolean;
    failed?: boolean;
    running?: boolean;
    promise?: Promise<void>;
}
