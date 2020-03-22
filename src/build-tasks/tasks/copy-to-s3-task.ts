import path from 'path';
import { ConsoleUtil } from '../../../src/console-util';
import { IBuildTaskConfiguration, IBuildTask } from '~build-tasks/build-configuration';
import { IOrganizationBinding } from '~parser/parser';
import { IBuildTaskProvider, BuildTaskProvider } from '~build-tasks/build-task-provider';
import { IPerformTasksCommandArgs } from '~commands/index';
import { IS3CopyCommandArgs, S3CopyCommand } from '~commands/s3copy/s3copy';

export class CopyToS3TaskProvider implements IBuildTaskProvider<ICopyToS3TaskConfiguration> {
    public type = 'copy-to-s3';

    createTask(config: ICopyToS3TaskConfiguration, command: IPerformTasksCommandArgs): IBuildTask {
        return {
            type: config.Type,
            name: config.LogicalName,
            physicalIdForCleanup: config.LogicalName,
            childTasks: [],
            isDependency: BuildTaskProvider.createIsDependency(config),
            perform: async (): Promise<void> => {
                ConsoleUtil.LogInfo(`executing: ${config.Type} ${config.LogicalName}`);

                const dir = path.dirname(config.FilePath);
                const localPath = path.join(dir, config.LocalPath);

                const updateSlsCommand: IS3CopyCommandArgs = {
                    ...command,
                    name: config.LogicalName,
                    localPath,
                    remotePath: config.RemotePath,
                    zipBeforePut: config.ZipBeforePut,
                    failedTolerance:config.FailedTaskTolerance,
                    maxConcurrent: config.MaxConcurrentTasks,
                    organizationBinding: config.OrganizationBinding,
                };

                await S3CopyCommand.Perform(updateSlsCommand);
            },
        };
    }

    createTaskForValidation(/* config: ICopyToS3TaskConfiguration, command: IPerformTasksCommandArgs*/): IBuildTask | undefined {
        return undefined;
        // return {
        //     type: config.Type,
        //     name: config.LogicalName,
        //     childTasks: [],
        //     isDependency: (): boolean => false,
        //     perform: async (): Promise<void> => {

        //     },
        // };
    }

    createTaskForCleanup(/* logicalId: string, physicalId: string, command: IPerformTasksCommandArgs*/): IBuildTask | undefined {
        return undefined;
        // return {
        //     type: 'cleanup-' + this.type,
        //     name: logicalId,
        //     physicalIdForCleanup: physicalId,
        //     childTasks: [],
        //     isDependency: (): boolean => false,
        //     perform: async (): Promise<void> => {

        //     },
        // };
    }
}


export interface ICopyToS3TaskConfiguration extends IBuildTaskConfiguration {
    LocalPath: string;
    RemotePath: string;
    ZipBeforePut?: true;
    OrganizationBinding: IOrganizationBinding;
    MaxConcurrentTasks?: number;
    FailedTaskTolerance?: number;
}
