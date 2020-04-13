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
import { IGenericTarget } from '~state/persisted-state';
import { ICfnExpression, ICfnSubExpression } from '~core/cfn-expression';
import { CfnExpressionResolver } from '~core/cfn-expression-resolver';

export class CdkBuildTaskPlugin implements IBuildTaskPlugin<ICdkBuildTaskConfig, ICdkCommandArgs, ICdkTask> {

    type = 'cdk';
    typeForTask = 'update-cdk';
    applyGlobally = false;

    convertToCommandArgs(config: ICdkBuildTaskConfig, command: IPerformTasksCommandArgs): ICdkCommandArgs {

        Validator.ThrowForUnknownAttribute(config, config.LogicalName, 'LogicalName', 'Path', 'DependsOn', 'Type',
            'FilePath', 'RunNpmInstall', 'RunNpmBuild', 'FailedTaskTolerance', 'MaxConcurrentTasks', 'OrganizationBinding',
            'TaskRoleName', 'AdditionalCdkArguments', 'InstallCommand', 'CustomDeployCommand', 'CustomRemoveCommand', 'Parameters');

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
            customDeployCommand: config.CustomDeployCommand,
            customRemoveCommand: config.CustomRemoveCommand,
            parameters: config.Parameters,
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
            customDeployCommand: command.customDeployCommand,
            customRemoveCommand: command.customRemoveCommand,
            parameters: command.parameters,
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
            customDeployCommand: command.customDeployCommand,
            customRemoveCommand: command.customRemoveCommand,
            parameters: command.parameters,
        };
    }

    async performCreateOrUpdate(binding: IPluginBinding<ICdkTask>, resolver: CfnExpressionResolver): Promise<void> {
        const { task, target } = binding;
        let command: string;
        // const resolver = PluginUtil.CreateExpressionResolver(task, target, template, state, CdkBuildTaskPlugin.GetParametersAsArgument);

        if (binding.task.customDeployCommand) {
            command = await resolver.resolveSingleExpression(binding.task.customDeployCommand);
        } else {
            const commandExpression = { 'Fn::Sub': 'npx cdk deploy ${CurrentTask.Parameters}' } as ICfnSubExpression;
            command = await resolver.resolveSingleExpression(commandExpression);

            if (binding.task.runNpmBuild) {
                command = 'npm run build && ' + command;
            }

            if (binding.task.runNpmInstall) {
                command = PluginUtil.PrependNpmInstall(task.path, command);
            }
        }

        const accountId = target.accountId;
        const cwd = path.resolve(task.path);
        const env = CdkBuildTaskPlugin.GetEnvironmentVariables(target);
        await ChildProcessUtility.SpawnProcessForAccount(cwd, command, accountId, task.taskRoleName, env);
    }

    async performRemove(binding: IPluginBinding<ICdkTask>, resolver: CfnExpressionResolver): Promise<void> {
        const { task, target } = binding;
        let command: string;
        // const resolver = PluginUtil.CreateExpressionResolver(task, target, template, state, CdkBuildTaskPlugin.GetParametersAsArgument);

        if (binding.task.customRemoveCommand) {
            command = await resolver.resolveSingleExpression(binding.task.customRemoveCommand);
        } else {
            const commandExpression = { 'Fn::Sub': 'npx cdk destroy ${CurrentTask.Parameters}' } as ICfnSubExpression;
            command = await resolver.resolveSingleExpression(commandExpression);

            if (binding.task.runNpmBuild) {
                command = 'npm run build && ' + command;
            }

            if (binding.task.runNpmInstall) {
                command = PluginUtil.PrependNpmInstall(task.path, command);
            }
        }

        const accountId = target.accountId;
        const cwd = path.resolve(task.path);
        const env = CdkBuildTaskPlugin.GetEnvironmentVariables(target);
        await ChildProcessUtility.SpawnProcessForAccount(cwd, command, accountId, task.taskRoleName, env);
    }

    async appendResolvers(resolver: CfnExpressionResolver, binding: IPluginBinding<ICdkTask>): Promise<void> {
        const { task } = binding;
        task.parameters = await resolver.resolve(task.parameters);
        const parametersAsString = CdkBuildTaskPlugin.GetParametersAsArgument(task.parameters);
        resolver.addResourceWithAttributes('CurrentTask',  { Parameters : parametersAsString });

    }

    static GetEnvironmentVariables(target: IGenericTarget<ICdkTask>): Record<string, string> {
        return {
            CDK_DEFAULT_REGION: target.region,
            CDK_DEFAULT_ACCOUNT: target.accountId,
        };
    }

    static GetParametersAsArgument(parameters: Record<string, any>): string {
        if (!parameters) {return '';}
        const entries = Object.entries(parameters);
        return entries.reduce((prev, curr) => prev + ` -c ${curr[0]}=${curr[1]}`, '');
    }
}


interface ICdkBuildTaskConfig extends IBuildTaskConfiguration {
    Path: string;
    OrganizationBinding: IOrganizationBinding;
    MaxConcurrentTasks?: number;
    FailedTaskTolerance?: number;
    RunNpmInstall?: boolean;
    RunNpmBuild?: boolean;
    CustomDeployCommand?: ICfnExpression;
    CustomRemoveCommand?: ICfnExpression;
    Parameters?: Record<string, ICfnExpression>;
}

export interface ICdkCommandArgs extends IBuildTaskPluginCommandArgs {
    path: string;
    runNpmInstall: boolean;
    runNpmBuild: boolean;
    customDeployCommand?: ICfnExpression;
    customRemoveCommand?: ICfnExpression;
    parameters?: Record<string, ICfnExpression>;
}

export interface ICdkTask extends IPluginTask {
    path: string;
    runNpmInstall: boolean;
    runNpmBuild: boolean;
    customDeployCommand?: ICfnExpression;
    customRemoveCommand?: ICfnExpression;
}
