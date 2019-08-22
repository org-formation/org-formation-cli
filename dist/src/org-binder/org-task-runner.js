"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class TaskRunner {
    static async RunTasks(tasks) {
        for (const task of tasks) {
            try {
                console.log(`executing task: ${task.action} ${task.type} ${task.logicalId}`);
                await task.perform(task);
                console.log(`result = ${task.result}`);
            }
            catch (err) {
                console.log(`failed executing task: ${task.action} ${task.type} ${task.logicalId} ${err}`);
                throw err;
            }
        }
    }
}
exports.TaskRunner = TaskRunner;
//# sourceMappingURL=org-task-runner.js.map