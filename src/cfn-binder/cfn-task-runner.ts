import { ICfnTask } from './cfn-task-provider';

export class CfnTaskRunner {

    public static async RunTasks(tasks: ICfnTask[]) {
        for (const task of tasks) {
            const dependentTasks = [];
            if (task.dependentTaskFilter) {
                dependentTasks.push(...tasks.filter(task.dependentTaskFilter));
            }
            const needToRunFirst = dependentTasks.filter((x) => !x.done);
            if (needToRunFirst.length > 0) {
                await CfnTaskRunner.RunTasks(needToRunFirst);
            }
            if (task.done) {
                continue;
            }
            try {
                console.log(`executing: ${task.action} ${task.accountId} ${task.region}`);
                await task.perform(task);
                task.done = true;
                console.log(`done`);
            } catch (err) {
                console.log(`failed executing task: ${err}`);
                throw err;
            }
        }
    }
}
