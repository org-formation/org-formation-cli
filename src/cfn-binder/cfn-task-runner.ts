import { ICfnTask } from './cfn-task-provider';

export class CfnTaskRunner {

    public static async RunTasks(tasks: ICfnTask[]) {
        for (const task of tasks) {
            try {
                console.log(`executing: ${task.action} ${task.accountId} ${task.region}`);
                await task.perform(task);
                console.log(`done`);
            } catch (err) {
                console.log(`failed executing task: ${err}`);
                throw err;
            }
        }
    }
}
