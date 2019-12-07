import { updateAccountResources, updateTemplate } from '../../index';
import { ConsoleUtil } from '../console-util';
import { GenericTaskRunner, ITaskRunnerDelegates } from '../core/generic-task-runner';
import { OrgFormationError } from '../org-formation-error';
import { IBuildTask } from './build-configuration';

export class BuildRunner {
    public static async RunTasks(tasks: IBuildTask[]) {
        const delegate: ITaskRunnerDelegates<IBuildTask> = {
            onTaskRanFailed: (task, err) => {ConsoleUtil.LogInfo(`task ${task.name} failed. \n${err}`); },
            onTaskRanSuccessfully: (task) => {ConsoleUtil.LogInfo(`task ${task.name} ran successfully`); },
            throwCircularDependency: (ts) => {throw new OrgFormationError(`circular dependency detected with tasks: ${ts.map((t) => t.name).join(', ')}`); },
            throwDependencyOnSelfException: (task) => {throw new OrgFormationError(`task ${task.name} has a dependency on itself.`); },
            maxNumberOfTasks: 1,
        };
        await GenericTaskRunner.RunTasks<IBuildTask>(tasks, delegate);
    }
}
