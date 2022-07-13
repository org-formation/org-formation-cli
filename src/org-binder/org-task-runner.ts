import { ConsoleUtil } from '../util/console-util';
import { IBuildTask } from './org-tasks-provider';

export class TaskRunner {

    public static async RunTasks(tasks: IBuildTask[]): Promise<void> {
        for (const task of tasks) {
            const dependentTasks = [];
            if (task.dependentTasks) {
                dependentTasks.push(...task.dependentTasks);
            }
            if (task.dependentTaskFilter) {
                dependentTasks.push(...tasks.filter(task.dependentTaskFilter));
            }
            const needToRunFirst = dependentTasks.filter(x => task !== x && !x.done);
            if (needToRunFirst.length > 0) {
                await TaskRunner.RunTasks(needToRunFirst);
            }
            if (task.done) {
                continue;
            }

            try {
                let line = `${task.type.padEnd(29, ' ')} | ${task.logicalId.padEnd(29, ' ')} | ${task.action}`;
                ConsoleUtil.LogDebug(`start executing task: ${task.action} ${task.type} ${task.logicalId}`);
                await task.perform(task);
                task.done = true;
                if (task.result) {
                    if (typeof task.result !== 'object'){
                        line += ` (${task.result})`;
                    } else if ('PhysicalId' in task.result) {
                        if (task.result.PhysicalId !== undefined) {
                            line += ` (${task.result.PhysicalId})`;
                        }
                    } else if ('commercial' in task.result) {
                        if (task.result.commercial !== undefined) {
                         line += ` (${task.result.commercial})`;
                        }
                    }
                }

                ConsoleUtil.Out(line);

            } catch (err) {
                ConsoleUtil.LogError(`failed executing task: ${task.action} ${task.type} ${task.logicalId} ${err}`);
                throw err;
            }
        }
    }
}
