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
import { ChildProcessUtility } from '~util/child-process-util';
import { Validator } from '~parser/validator';
import { PluginUtil } from '~plugin/plugin-util';

export class CdkBuildTaskPlugin implements IBuildTaskPlugin<ICdkBuildTaskConfig, ICdkCommandArgs, ICdkTask> {
    type = 'cdk';
    typeForTask = 'update-cdk';
    applyGlobally = true;

    convertToCommandArgs(config: ICdkBuildTaskConfig, command: IPerformTasksCommandArgs): ICdkCommandArgs {

        Validator.ThrowForUnknownAttribute(config, config.LogicalName, 'LogicalName', 'Path',  'Type',
            'FilePath', 'RunNpmInstall', 'RunNpmBuild', 'FailedTaskTolerance', 'MaxConcurrentTasks', 'OrganizationBinding',
            'TaskRoleName', 'AdditionalCdkArguments', 'InstallCommand');

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
            failedTolerance: config.FailedTaskTolerance ?? 0,
            maxConcurrent: config.MaxConcurrentTasks ?? 1,
            organizationBinding: config.OrganizationBinding,
            taskRoleName: config.TaskRoleName,
            additionalCdkArguments: config.AdditionalCdkArguments,
            installCommand: config.InstallCommand,
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

            if (commandArgs.installCommand !== undefined) {
                throw new OrgFormationError(`task ${commandArgs.name} specifies 'RunNpmInstall' therefore cannot also specify 'InstallCommand'`);
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
            additionalArguments: command.additionalCdkArguments,
            installCommand: command.installCommand,
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
            additionalCdkArguments: command.additionalCdkArguments,
            installCommand: command.installCommand,
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

        if (binding.task.installCommand) {
            command = binding.task.installCommand + ' && ' + command;
        }

        if (binding.task.additionalCdkArguments) {
            command = command + ' ' + binding.task.additionalCdkArguments;
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

        if (binding.task.installCommand) {
            command = binding.task.installCommand + ' && ' + command;
        }

        if (binding.task.additionalCdkArguments) {
            command = command + ' ' + binding.task.additionalCdkArguments;
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
    InstallCommand?: string;
    AdditionalCdkArguments?: string;
}

interface ICdkCommandArgs extends IBuildTaskPluginCommandArgs {
    path: string;
    runNpmInstall: boolean;
    runNpmBuild: boolean;
    installCommand?: string;
    additionalCdkArguments?: string;
}

interface ICdkTask extends IPluginTask {
    path: string;
    runNpmInstall: boolean;
    runNpmBuild: boolean;
    installCommand?: string;
    additionalCdkArguments?: string;
}
