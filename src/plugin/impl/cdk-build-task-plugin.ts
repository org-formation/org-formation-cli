import path from 'path';
import { existsSync } from 'fs';
import { IBuildTaskPlugin, IBuildTaskPluginCommandArgs } from '../plugin';
import { OrgFormationError } from '../../../src/org-formation-error';
import { ConsoleUtil } from '../../util/console-util';
import { IBuildTaskConfiguration } from '~build-tasks/build-configuration';
import { IPluginBinding, IPluginTask } from '~plugin/plugin-binder';
import { IOrganizationBinding } from '~parser/parser';
import { IPerformTasksCommandArgs } from '~commands/index';
import { Md5Util } from '~util/md5-util';
import { ChildProcessUtility } from '~core/child-process-util';
import { Validator } from '~parser/validator';
import { PluginUtil } from '~plugin/plugin-util';

export class CdkBuildTaskPlugin implements IBuildTaskPlugin<ICdkBuildTaskConfig, ICdkCommandArgs, ICdkTask> {
    type = 'cdk';
    typeForTask = 'update-cdk';
    applyGlobally = true;

    convertToCommandArgs(config: ICdkBuildTaskConfig, command: IPerformTasksCommandArgs): ICdkCommandArgs {

        if (!config.Path) {
            throw new OrgFormationError(`task ${config.LogicalName} does not have required attribute Path`);
        }

        const dir = path.dirname(config.FilePath);
        const cdkPath = path.join(dir, config.Path);

        return {
            ...command,
            name: config.LogicalName,
            runNpmInstall: config.RunNpmInstall === true,
            runNpmBuild: config.RunNpmBuild === true,
            path: cdkPath,
            failedTolerance: config.FailedTaskTolerance,
            maxConcurrent: config.MaxConcurrentTasks,
            organizationBinding: config.OrganizationBinding,
            taskRoleName: config.TaskRoleName,
            customAdditionalCdkArguments: config.CustomAdditionalCdkArguments,
            customInstallCommand: config.CustomInstallCommand,
        };
    }

    validateCommandArgs(commandArgs: ICdkCommandArgs): void {
        if (!commandArgs.organizationBinding) {
            throw new OrgFormationError(`task ${commandArgs.name} does not have required attribute OrganizationBinding`);
        }

        if (!existsSync(commandArgs.path)) {
            throw new OrgFormationError(`task ${commandArgs.name} cannot find path ${commandArgs.path}`);
        }

        if (commandArgs.runNpmInstall) {

            if (commandArgs.customInstallCommand !== undefined) {
                throw new OrgFormationError(`task ${commandArgs.name} specifies 'RunNpmInstall' therefore cannot also specify 'CustomInstallCommand'`);
            }

            const packageFilePath = path.join(commandArgs.path, 'package.json');
            if (!existsSync(packageFilePath)) {
                throw new OrgFormationError(`task ${commandArgs.name} specifies 'RunNpmInstall' but cannot find npm package file ${packageFilePath}`);
            }

            const packageLockFilePath = path.join(commandArgs.path, 'package-lock.json');
            if (!existsSync(packageLockFilePath)) {
                ConsoleUtil.LogWarning(`task ${commandArgs.name} specifies 'RunNpmInstall' but cannot find npm package file ${packageLockFilePath}. Will perform 'npm i' as opposed to 'npm ci'.`);
            }
        }
        Validator.ValidateOrganizationBinding(commandArgs.organizationBinding, commandArgs.name);
    }

    getValuesForEquality(command: ICdkCommandArgs): any {
        const hashOfCdkDirectory = Md5Util.Md5OfPath(command.path);
        return {
            runNpmInstall: command.runNpmInstall,
            path: hashOfCdkDirectory,
            customAdditionalArguments: command.customAdditionalCdkArguments,
            customInstallCommand: command.customAdditionalCdkArguments,
        };
    }

    convertToTask(command: ICdkCommandArgs, hashOfTask: string): ICdkTask {
        return {
            type: this.type,
            name: command.name,
            path: command.path,
            hash: hashOfTask,
            runNpmInstall: command.runNpmInstall,
            runNpmBuild: command.runNpmBuild,
            taskRoleName: command.taskRoleName,
            customAdditionalCdkArguments: command.customAdditionalCdkArguments,
            customInstallCommand: command.customAdditionalCdkArguments,
        };
    }

    async performCreateOrUpdate(binding: IPluginBinding<ICdkTask>): Promise<void> {
        const { task, target } = binding;
        let command = 'npx cdk deploy';

        if (binding.task.runNpmBuild) {
            command = 'npm run build && ' + command;
        }

        if (binding.task.runNpmInstall) {
            command = PluginUtil.PrependNpmInstall(task.path, command);
        }

        if (binding.task.customInstallCommand) {
            command = binding.task.customInstallCommand + ' && ' + command;
        }

        if (binding.task.customAdditionalCdkArguments) {
            command = command + ' ' + binding.task.customAdditionalCdkArguments;
        }

        const accountId = target.accountId;
        const cwd = path.resolve(task.path);
        await ChildProcessUtility.SpawnProcessForAccount(cwd, command, accountId, task.taskRoleName);
    }

    async performDelete(binding: IPluginBinding<ICdkTask>): Promise<void> {
        const { task, target } = binding;
        let command = 'npx cdk destroy';

        if (binding.task.runNpmInstall) {
            command = PluginUtil.PrependNpmInstall(task.path, command);
        }

        if (binding.task.runNpmBuild) {
            command = 'npm run build && ' + command;
        }

        if (binding.task.customInstallCommand) {
            command = binding.task.customInstallCommand + ' && ' + command;
        }

        if (binding.task.customAdditionalCdkArguments) {
            command = command + ' ' + binding.task.customAdditionalCdkArguments;
        }

        const accountId = target.accountId;
        const cwd = path.resolve(task.path);

        await ChildProcessUtility.SpawnProcessForAccount(cwd, command, accountId, task.taskRoleName);
    }
}


interface ICdkBuildTaskConfig extends IBuildTaskConfiguration {
    Path: string;
    OrganizationBinding: IOrganizationBinding;
    MaxConcurrentTasks?: number;
    FailedTaskTolerance?: number;
    RunNpmInstall?: boolean;
    RunNpmBuild?: boolean;
    CustomInstallCommand?: string;
    CustomAdditionalCdkArguments?: string;
}

interface ICdkCommandArgs extends IBuildTaskPluginCommandArgs {
    path: string;
    runNpmInstall: boolean;
    runNpmBuild: boolean;
    customInstallCommand?: string;
    customAdditionalCdkArguments?: string;
}

interface ICdkTask extends IPluginTask {
    path: string;
    runNpmInstall: boolean;
    runNpmBuild: boolean;
    customInstallCommand?: string;
    customAdditionalCdkArguments?: string;
}
