import { IBuildTask } from './org-tasks-provider';

export class TaskRunner {

    public static async RunTasks(tasks: IBuildTask[]) {
        for (const task of tasks) {
            const dependentTasks = [];
            if (task.dependentTasks) {
                dependentTasks.push(...task.dependentTasks);
            }
            if (task.dependentTaskFilter) {
                dependentTasks.push(...tasks.filter(task.dependentTaskFilter));
            }
            const needToRunFirst = dependentTasks.filter((x) => !x.done);
            if (needToRunFirst.length > 0) {
                await TaskRunner.RunTasks(needToRunFirst);
            }
            if (task.done) {
                continue;
            }

            try {

                console.log(`executing task: ${task.action} ${task.type} ${task.logicalId}`);

                await task.perform(task);
                task.done = true;
                if (task.result) {
                    console.log(`result = ${task.result}`);
                }
            } catch (err) {
                console.log(`failed executing task: ${task.action} ${task.type} ${task.logicalId} ${err}`);
                throw err;
            }
        }
    }
}
