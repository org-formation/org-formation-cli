import { IBuildTask } from './org-tasks-provider';

export class TaskRunner {

    public static async RunTasks(tasks: IBuildTask[]) {
        for (const task of tasks) {
            try {
                console.log(`executing task: ${task.action} ${task.type} ${task.logicalId}`);
                await task.perform(task);
                console.log(`result = ${task.result}`);
            } catch (err) {
                console.log(`failed executing task: ${task.action} ${task.type} ${task.logicalId} ${err}`);
                throw err;
            }
        }
    }
}
