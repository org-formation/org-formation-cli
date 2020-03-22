import path from 'path';
import { existsSync } from 'fs';
import { ConsoleUtil } from '../../../src/console-util';
import { OrgFormationError } from '../../../src/org-formation-error';
import { IBuildTask, IBuildTaskConfiguration } from '~build-tasks/build-configuration';
import { ICommandArgs, IUpdateSlsCommandArgs, UpdateSlsCommand, IPerformTasksCommandArgs, ServerlessGenericTaskType, CleanupCommand} from '~commands/index';
import { IOrganizationBinding } from '~parser/parser';
import { IBuildTaskProvider, BuildTaskProvider } from '~build-tasks/build-task-provider';
import { Validator } from '~parser/validator';

export class UpdateServerlessComBuildTaskProvider implements IBuildTaskProvider<IServerlessComTaskConfiguration> {
    public type = 'update-serverless.com';

    createTask(config: IServerlessComTaskConfiguration, command: ICommandArgs): IBuildTask {

        UpdateServerlessComBuildTaskProvider.validateConfig(config);

        return {
            type: config.Type,
            name: config.LogicalName,
            physicalIdForCleanup: config.LogicalName,
            childTasks: [],
            isDependency: BuildTaskProvider.createIsDependency(config),
            perform: async (): Promise<void> => {
                ConsoleUtil.LogInfo(`executing: ${config.Type} ${config.LogicalName}`);

                const dir = path.dirname(config.FilePath);
                const slsPath = path.join(dir, config.Path);

                const updateSlsCommand: IUpdateSlsCommandArgs = {
                    ...command,
                    name: config.LogicalName,
                    stage: config.Stage,
                    path: slsPath,
                    runNpmInstall: config.RunNpmInstall === true,
                    failedTolerance:config.FailedTaskTolerance,
                    maxConcurrent: config.MaxConcurrentTasks,
                    organizationBinding: config.OrganizationBinding,
                };

                await UpdateSlsCommand.Perform(updateSlsCommand);
            },
        };
    }

    createTaskForValidation(config: IServerlessComTaskConfiguration): IBuildTask | undefined {
        return {
            type: config.Type,
            name: config.LogicalName,
            childTasks: [],
            isDependency: (): boolean => false,
            perform: async (): Promise<void> => UpdateServerlessComBuildTaskProvider.validateConfig(config),
        };
    }

    createTaskForCleanup(logicalId: string, physicalId: string, command: IPerformTasksCommandArgs): IBuildTask | undefined {
        return {
            type: 'cleanup-' + this.type,
            name: logicalId,
            childTasks: [],
            isDependency: (): boolean => false,
            perform: async (): Promise<void> => {
                if (!command.performCleanup) {
                    ConsoleUtil.LogWarning('Hi there, it seems you have removed a task!');
                    ConsoleUtil.LogWarning(`The task was called ${logicalId} and used to deploy a serverless.com project.`);
                    ConsoleUtil.LogWarning('By default these tasks dont get cleaned up. You can change this by adding the option --perfom-cleanup.');
                    ConsoleUtil.LogWarning('You can remove the project manually by running the following command:');
                    ConsoleUtil.LogWarning('');
                    ConsoleUtil.LogWarning(`    org-formation cleanup --type ${ServerlessGenericTaskType} --name ${logicalId}`);
                    ConsoleUtil.LogWarning('');
                    ConsoleUtil.LogWarning('Did you not remove a task? but are you logically using different files? check out the --logical-name option.');
                } else {
                    ConsoleUtil.LogInfo(`executing: ${this.type} ${logicalId}`);
                    await CleanupCommand.Perform({ ...command,  name: logicalId, type: ServerlessGenericTaskType, maxConcurrentTasks: 10, failedTasksTolerance: 10 });
                }
            },
        };
    }

    static validateConfig(config: IServerlessComTaskConfiguration): void {
        const dir = path.dirname(config.FilePath);
        const slsDirPath = path.join(dir, config.Path);
        if (!config.Path) {
            throw new OrgFormationError(`task ${config.LogicalName} does not have required attribute Path`);
        }
        if (!config.OrganizationBinding) {
            throw new OrgFormationError(`task ${config.LogicalName} does not have required attribute OrganizationBinding`);
        }

        if (!existsSync(slsDirPath)) {
            throw new OrgFormationError(`task ${config.LogicalName} cannot find path ${config.Path}`);
        }

        const serverlessFileName = config.Config ? config.Config : 'serverless.yml';
        const serverlessPath = path.join(slsDirPath, serverlessFileName);

        if (!existsSync(serverlessPath)) {
            throw new OrgFormationError(`task ${config.LogicalName} cannot find serverless configuration file ${serverlessPath}`);
        }

        if (config.RunNpmInstall === true) {
            const packageFilePath = path.join(slsDirPath, 'package.json');
            if (!existsSync(packageFilePath)) {
                const relative = path.join(config.Path, 'package.json');
                throw new OrgFormationError(`task ${config.LogicalName} specifies 'RunNpmInstall' but cannot find npm package file ${relative}`);
            }

            const packageLockFilePath = path.join(slsDirPath, 'package-lock.json');
            if (!existsSync(packageLockFilePath)) {
                const relative = path.join(config.Path, 'package-lock.json');
                ConsoleUtil.LogWarning(`task ${config.LogicalName} specifies 'RunNpmInstall' but cannot find npm package file ${relative}. Will perform 'npm i' as opposed to 'npm ci'.`);
            }
        }
        Validator.ValidateOrganizationBinding(config.OrganizationBinding, config.LogicalName);
    }
}

export interface IServerlessComTaskConfiguration extends IBuildTaskConfiguration {
    Path: string;
    Config?: string;
    Stage?: string;
    OrganizationBinding: IOrganizationBinding;
    MaxConcurrentTasks?: number;
    FailedTaskTolerance?: number;
    RunNpmInstall?: boolean;
}
