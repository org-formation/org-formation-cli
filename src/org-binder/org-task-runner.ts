import { ConsoleUtil } from '../console-util';
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
            const needToRunFirst = dependentTasks.filter((x) => task !== x && !x.done);
            if (needToRunFirst.length > 0) {
                await TaskRunner.RunTasks(needToRunFirst);
            }
            if (task.done) {
                continue;
            }

            try {
                let line = `${task.type.padEnd(29, ' ')} | ${task.logicalId.padEnd(29, ' ')} | ${task.action}`;
                await task.perform(task);
                task.done = true;
                if (task.result) {
                    line += ` (${task.result})`;
                }

                ConsoleUtil.Out(line);

            } catch (err) {
                ConsoleUtil.LogError(`failed executing task: ${task.action} ${task.type} ${task.logicalId} ${err}`);
                throw err;
            }
        }
    }
}
