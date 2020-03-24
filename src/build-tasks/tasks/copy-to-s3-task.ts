import path from 'path';
import { existsSync } from 'fs';
import { ConsoleUtil } from '../../../src/console-util';
import { OrgFormationError } from '../../../src/org-formation-error';
import { IBuildTaskConfiguration, IBuildTask } from '~build-tasks/build-configuration';
import { IOrganizationBinding } from '~parser/parser';
import { IBuildTaskProvider, BuildTaskProvider } from '~build-tasks/build-task-provider';
import { IPerformTasksCommandArgs } from '~commands/index';
import { IS3CopyCommandArgs, S3CopyCommand } from '~commands/s3copy/s3copy';
import { Validator } from '~parser/validator';

export class CopyToS3TaskProvider implements IBuildTaskProvider<ICopyToS3TaskConfiguration> {
    public type = 'copy-to-s3';

    createTask(config: ICopyToS3TaskConfiguration, command: IPerformTasksCommandArgs): IBuildTask {
        CopyToS3TaskProvider.validateConfig(config);

        return {
            type: config.Type,
            name: config.LogicalName,
            // physicalIdForCleanup: config.LogicalName,
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
                    taskRoleName: config.TaskRoleName,
                };

                await S3CopyCommand.Perform(updateSlsCommand);
            },
        };
    }

    createTaskForValidation(config: ICopyToS3TaskConfiguration): IBuildTask | undefined {
        return {
            type: config.Type,
            name: config.LogicalName,
            childTasks: [],
            isDependency: (): boolean => false,
            perform: async (): Promise<void> => {
                CopyToS3TaskProvider.validateConfig(config);
            },
        };
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


    static validateConfig(config: ICopyToS3TaskConfiguration): void {
        if (!config.LocalPath) {
            throw new OrgFormationError(`task ${config.LogicalName} does not have required attribute LocalPath`);
        }
        if (!config.RemotePath) {
            throw new OrgFormationError(`task ${config.LogicalName} does not have required attribute RemotePath`);
        }

        const dir = path.dirname(config.FilePath);
        const localPath = path.join(dir, config.LocalPath);

        if (!existsSync(localPath)) {
            throw new OrgFormationError(`task ${config.LogicalName} cannot find path ${config.FilePath}`);
        }

        Validator.ValidateOrganizationBinding(config.OrganizationBinding, config.LogicalName);
    }
}


export interface ICopyToS3TaskConfiguration extends IBuildTaskConfiguration {
    LocalPath: string;
    RemotePath: string;
    ZipBeforePut?: true;
    OrganizationBinding: IOrganizationBinding;
    MaxConcurrentTasks?: number;
    FailedTaskTolerance?: number;
    TaskRoleName?: string;
}
