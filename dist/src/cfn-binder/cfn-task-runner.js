"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class CfnTaskRunner {
    static async RunTasks(tasks) {
        for (const task of tasks) {
            try {
                console.log(`executing: ${task.action} ${task.accountId} ${task.region}`);
                await task.perform(task);
                console.log(`done`);
            }
            catch (err) {
                console.log(`failed executing task: ${err}`);
                throw err;
            }
        }
    }
}
exports.CfnTaskRunner = CfnTaskRunner;
//# sourceMappingURL=cfn-task-runner.js.map