import { updateAccountResources, updateTemplate } from '../../index';
import { IBuildTask } from './build-configuration';

export class BuildRunner {
    public static async RunTasks(tasks: IBuildTask[], command: any) {
        for (const task of tasks) {

            if (task.done) {
                continue;
            }

            if (task.type === 'update-stacks') {
                const updateOrgTasks = tasks.filter((x) => x.type === 'update-organization' && !x.done);
                if (updateOrgTasks.length !== 0) {
                    await BuildRunner.RunTasks(updateOrgTasks, command);
                }
            }

            try {
                await task.perform(command);
                task.done = true;
                console.log(`done`);
            } catch (err) {
                console.log(`failed executing task: ${err}`);
                throw err;
            }
        }
    }
}
