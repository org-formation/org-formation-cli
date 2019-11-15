import { ConsoleUtil } from '../console-util';
import { ICfnTask } from './cfn-task-provider';

export class CfnTaskRunner {

    public static async RunTasks(tasks: ICfnTask[], stackName: string) {
        const runningTasks: Array<Promise<void>> = [];
        for (const task of tasks) {
            const dependentTasks = [];
            if (task.dependentTaskFilter) {
                dependentTasks.push(...tasks.filter(task.dependentTaskFilter));
            }
            const needToRunFirst = dependentTasks.filter((x) => !x.done);
            if (needToRunFirst.length > 0) {
                await CfnTaskRunner.RunTasks(needToRunFirst, stackName);
            }
            if (task.done) {
                continue;
            }
            const taskPromise = this.performTask(task);
            runningTasks.push(taskPromise);
        }
        ConsoleUtil.LogInfo(`executing stack ${stackName} in ${runningTasks.length} target accounts/regions.`);
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
