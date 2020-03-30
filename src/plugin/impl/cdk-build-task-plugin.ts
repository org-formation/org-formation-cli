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

export class CdkBuildTaskPlugin implements IBuildTaskPlugin<ICdkBuildTaskConfig, ICdkCommandArgs, ICdkTask> {
    type = 'cdk';
    typeForTask = 'update-cdk';

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
            path: cdkPath,
            failedTolerance: config.FailedTaskTolerance,
            maxConcurrent: config.MaxConcurrentTasks,
            organizationBinding: config.OrganizationBinding,
            taskRoleName: config.TaskRoleName,
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
        };
    }

    concertToTask(command: ICdkCommandArgs, hashOfTask: string): ICdkTask {
        return {
            type: this.type,
            name: command.name,
            path: command.path,
            hash: hashOfTask,
            runNpmInstall: command.runNpmInstall,
            taskRoleName: command.taskRoleName,
        };
    }

    async performCreateOrUpdate(binding: IPluginBinding<ICdkTask>): Promise<void> {
        const { task, target } = binding;
        let command = 'npm run build && npx cdk deploy';

        const hasPackageLock = existsSync(path.resolve(task.path, 'package-lock.json'));
        if (binding.task.runNpmInstall && hasPackageLock) {
            command = 'npm ci && ' + command;
        } else {
            command = 'npm i && ' + command;
        }

        const accountId = target.accountId;
        const cwd = path.resolve(task.path);
        await ChildProcessUtility.SpawnProcessForAccount(cwd, command, accountId, task.taskRoleName);
    }

    async performDelete(binding: IPluginBinding<ICdkTask>): Promise<void> {
        const { task, target } = binding;
        let command = 'npx cdk destroy';

        const pacakgeLockExists = existsSync(path.resolve(task.path, 'package-lock.json'));
        if (binding.task.runNpmInstall && pacakgeLockExists) {
            command = 'npm ci && ' + command;
        } else {
            command = 'npm i && ' + command;
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
}

interface ICdkCommandArgs extends IBuildTaskPluginCommandArgs {
    path: string;
    runNpmInstall: boolean;
}

interface ICdkTask extends IPluginTask {
    path: string;
    runNpmInstall: boolean;
}
