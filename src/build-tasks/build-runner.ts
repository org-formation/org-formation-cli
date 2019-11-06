import { updateAccountResources } from '../../index';
import { IBuildTask } from './build-configuration';

export class BuildRunner {
    public static async RunTasks(tasks: IBuildTask[], command: any) {
        for (const task of tasks) {
            if (task.done) {
                continue;
            }
            try {
                console.log(`executing: ${task.Type} ${task.Template} ${task.StackName}`);
                if (task.Type === 'update-stacks') {

                    await updateAccountResources(task.Template, {...command, stackName: task.StackName} as any );
                }
                task.done = true;
                console.log(`done`);
            } catch (err) {
                console.log(`failed executing task: ${err}`);
                throw err;
            }
        }
    }
}
