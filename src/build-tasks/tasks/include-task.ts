import path from 'path';
import { ConsoleUtil } from '../../../src/console-util';
import { OrgFormationError } from '../../../src/org-formation-error';
import { IBuildTask, BuildConfiguration, IBuildTaskConfiguration } from '~build-tasks/build-configuration';
import { IPerformTasksCommandArgs } from '~commands/index';
import { BuildRunner } from '~build-tasks/build-runner';
import { IBuildTaskProvider, BuildTaskProvider } from '~build-tasks/build-task-provider';


export class IncludeTaskProvider implements IBuildTaskProvider<IIncludeTaskConfiguration> {
    public type = 'include';

    createTask(config: IIncludeTaskConfiguration, command: IPerformTasksCommandArgs): IBuildTask {

        if (config.Path === undefined) {
            throw new OrgFormationError(`Required atrribute Path missing for task ${config.LogicalName}`);
        }

        const dir = path.dirname(config.FilePath);
        const taskFilePath = path.join(dir, config.Path);
        const buildConfig = new BuildConfiguration(taskFilePath);
        const childTasks = buildConfig.enumBuildTasks(command as IPerformTasksCommandArgs);

        return {
            type: config.Type,
            name: config.LogicalName,
            childTasks,
            isDependency: BuildTaskProvider.createIsDependency(config),
            perform: async (): Promise<void> => {
                ConsoleUtil.LogInfo(`executing: ${config.Type} ${taskFilePath}`);
                await BuildRunner.RunValidationTasks(childTasks, 1, 999);
            },
        };
    }

    createTaskForValidation(config: IIncludeTaskConfiguration, command: IPerformTasksCommandArgs): IBuildTask | undefined {

        if (config.Path === undefined) {
            throw new OrgFormationError(`Required atrribute Path missing for task ${config.LogicalName}`);
        }

        const dir = path.dirname(config.FilePath);
        const taskFilePath = path.join(dir, config.Path);
        const buildConfig = new BuildConfiguration(taskFilePath);
        const childTasks = buildConfig.enumValidationTasks(command as IPerformTasksCommandArgs);

        return {
            type: config.Type,
            name: config.LogicalName,
            childTasks,
            isDependency: (): boolean => false,
            perform: async (): Promise<void> => await BuildRunner.RunValidationTasks(childTasks, 1, 999),
        };
    }

    createTaskForCleanup(): IBuildTask | undefined {
        return undefined;
    }

}
export interface IIncludeTaskConfiguration extends IBuildTaskConfiguration {
    Path: string;
    MaxConcurrentTasks?: number;
    FailedTaskTolerance?: number;
}
