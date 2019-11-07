import { updateAccountResources, updateTemplate } from '../../index';
import { IBuildTask } from './build-configuration';

export class BuildRunner {
    public static async RunTasks(tasks: IBuildTask[], command: any) {
        for (const task of tasks) {

            if (task.done) {
                continue;
            }

            if (task.Type === 'update-stacks') {
                const updateOrgTasks = tasks.filter((x) => x.Type === 'update-organization' && !x.done);
                if (updateOrgTasks.length !== 0) {
                    await BuildRunner.RunTasks(updateOrgTasks, command);
                }
            }

            try {
                if (task.Type === 'update-organization') {
                    console.log(`executing: ${task.Type} ${task.Template}`);
                    await updateTemplate(task.Template, command as any );
                } else  if (task.Type === 'update-stacks') {
                    console.log(`executing: ${task.Type} ${task.Template} ${task.StackName}`);
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
