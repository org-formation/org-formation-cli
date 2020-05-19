import path from 'path';
import { ConsoleUtil } from '../../util/console-util';
import { OrgFormationError } from '../../../src/org-formation-error';
import { IBuildTask, BuildConfiguration, IBuildTaskConfiguration } from '~build-tasks/build-configuration';
import { IPerformTasksCommandArgs } from '~commands/index';
import { BuildRunner } from '~build-tasks/build-runner';
import { IBuildTaskProvider, BuildTaskProvider } from '~build-tasks/build-task-provider';


export class IncludeTaskProvider implements IBuildTaskProvider<IIncludeTaskConfiguration> {
    public type = 'include';

    createTask(config: IIncludeTaskConfiguration, command: IPerformTasksCommandArgs): IBuildTask {

        if (config.Path === undefined) {
            throw new OrgFormationError(`Required attribute Path missing for task ${config.LogicalName}`);
        }

        const dir = path.dirname(config.FilePath);
        const taskFilePath = path.join(dir, config.Path);
        const parameters: Record<string, any> = { ...command.parsedParameters, ...(config.Parameters ?? {}) };
        const buildConfig = new BuildConfiguration(taskFilePath, parameters);
        const childTasks = buildConfig.enumBuildTasks(command as IPerformTasksCommandArgs);

        if (config.SubtaskPrefix !== undefined) {
            childTasks.forEach(child => {
                child.name = config.SubtaskPrefix.concat(child.name);
            });
        }

        return {
            type: config.Type,
            name: config.LogicalName,
            childTasks,
            skip: config.Skip === true,
            isDependency: BuildTaskProvider.createIsDependency(config),
            perform: async (): Promise<void> => {
                ConsoleUtil.LogInfo(`Executing: ${config.Type} ${taskFilePath}.`);
                await BuildRunner.RunTasks(childTasks, config.MaxConcurrentTasks, config.FailedTaskTolerance);
            },
        };
    }

    createTaskForValidation(config: IIncludeTaskConfiguration, command: IPerformTasksCommandArgs): IBuildTask | undefined {

        if (config.Path === undefined) {
            throw new OrgFormationError(`Required attribute Path missing for task ${config.LogicalName}`);
        }

        const dir = path.dirname(config.FilePath);
        const taskFilePath = path.join(dir, config.Path);
        const parameters: Record<string, any> = { ...command.parsedParameters, ...(config.Parameters ?? {}) };
        const buildConfig = new BuildConfiguration(taskFilePath, parameters);
        const childTasks = buildConfig.enumValidationTasks(command as IPerformTasksCommandArgs);

        if (config.SubtaskPrefix !== undefined) {
            childTasks.forEach(child => {
                child.name = config.SubtaskPrefix.concat(child.name);
            });
        }

        return {
            type: config.Type,
            name: config.LogicalName,
            skip: config.Skip === true,
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
    Parameters: Record<string, any>;
    MaxConcurrentTasks?: number;
    FailedTaskTolerance?: number;
    SubtaskPrefix?: string;
}
