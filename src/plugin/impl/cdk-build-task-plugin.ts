import path from 'path';
import { existsSync } from 'fs';
import { IBuildTaskPlugin, IBuildTaskPluginCommandArgs, CommonTaskAttributeNames } from '../plugin';
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

    convertToCommandArgs(config: ICdkBuildTaskConfig, command: IPerformTasksCommandArgs): ICdkCommandArgs {

        Validator.ThrowForUnknownAttribute(config, config.LogicalName, ...CommonTaskAttributeNames, 'Path',
            'FilePath', 'RunNpmInstall', 'RunNpmBuild', 'FailedTaskTolerance', 'MaxConcurrentTasks',
            'AdditionalCdkArguments', 'InstallCommand', 'CustomDeployCommand', 'CustomRemoveCommand', 'Parameters','IgnoreFileChanges');

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
            ignoreFileChanges: Array.isArray(config.IgnoreFileChanges) ? config.IgnoreFileChanges : typeof config.IgnoreFileChanges === 'string' ? [config.IgnoreFileChanges] : [],
        };
    }

    validateCommandArgs(commandArgs: ICdkCommandArgs): void {
        if (!commandArgs.organizationBinding) {
            throw new OrgFormationError(`task ${commandArgs.name} does not have required attribute OrganizationBinding`);
        }

        if (commandArgs.maxConcurrent > 1) {
            throw new OrgFormationError(`task ${commandArgs.name} does not support a MaxConcurrentTasks higher than 1`);
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

        // Validator.ValidateCustomCommand(commandArgs.customDeployCommand, commandArgs.name, 'CustomDeployCommand');
        // Validator.ValidateCustomCommand(commandArgs.customRemoveCommand, commandArgs.name, 'CustomRemoveCommand');

        Validator.ValidateOrganizationBinding(commandArgs.organizationBinding, commandArgs.name);
    }

    getValuesForEquality(command: ICdkCommandArgs): any {
        const hashOfCdkDirectory = Md5Util.Md5OfPath(command.path, command.ignoreFileChanges);
        return {
            runNpmInstall: command.runNpmInstall,
            path: hashOfCdkDirectory,
            customDeployCommand: command.customDeployCommand,
            customRemoveCommand: command.customRemoveCommand,
            parameters: command.parameters,
        };
    }

    convertToTask(command: ICdkCommandArgs, globalHash: string): ICdkTask {
        return {
            type: this.type,
            name: command.name,
            path: command.path,
            hash: globalHash,
            runNpmInstall: command.runNpmInstall,
            runNpmBuild: command.runNpmBuild,
            taskRoleName: command.taskRoleName,
            customDeployCommand: command.customDeployCommand,
            customRemoveCommand: command.customRemoveCommand,
            parameters: command.parameters,
            forceDeploy: typeof command.forceDeploy === 'boolean' ? command.forceDeploy : false,
            logVerbose: typeof command.verbose === 'boolean' ? command.verbose : false,
        };
    }

    async performCreateOrUpdate(binding: IPluginBinding<ICdkTask>, resolver: CfnExpressionResolver): Promise<void> {

        const {task, target, previousBindingLocalHash } = binding;
        if (task.forceDeploy !== true &&
            task.taskLocalHash !== undefined &&
            task.taskLocalHash === previousBindingLocalHash) {

            ConsoleUtil.LogInfo(`Workload (${this.typeForTask}) ${task.name} in ${target.accountId}/${target.region} skipped, task itself did not change. Use ForceTask to force deployment.`);
            return;
        }

        let command: string;

        if (task.customDeployCommand) {
            Validator.throwForUnresolvedExpressions(task.customDeployCommand, 'CustomDeployCommand');
            command = task.customDeployCommand as string;
        } else {
            const commandExpression = { 'Fn::Sub': 'npx cdk deploy --all --require-approval=never ${CurrentTask.Parameters}' } as ICfnSubExpression;
            command = await resolver.resolveSingleExpression(commandExpression, 'CustomDeployCommand');

            if (task.runNpmBuild) {
                command = 'npm run build && ' + command;
            }

            if (task.runNpmInstall) {
                command = PluginUtil.PrependNpmInstall(task.path, command);
            }
        }

        const accountId = target.accountId;
        const cwd = path.resolve(task.path);
        const env = CdkBuildTaskPlugin.GetEnvironmentVariables(target);
        await ChildProcessUtility.SpawnProcessForAccount(cwd, command, accountId, task.taskRoleName, target.region, env, task.logVerbose);
    }

    async performRemove(binding: IPluginBinding<ICdkTask>, resolver: CfnExpressionResolver): Promise<void> {
        const { task, target } = binding;
        let command: string;

        if (task.customRemoveCommand) {
            Validator.throwForUnresolvedExpressions(task.customRemoveCommand, 'CustomRemoveCommand');
            command = task.customRemoveCommand as string;
        } else {
            const commandExpression = { 'Fn::Sub': 'npx cdk destroy --all --require-approval=never ${CurrentTask.Parameters}' } as ICfnSubExpression;
            command = await resolver.resolveSingleExpression(commandExpression, 'CustomRemoveCommand');

            if (task.runNpmBuild) {
                command = 'npm run build && ' + command;
            }

            if (task.runNpmInstall) {
                command = PluginUtil.PrependNpmInstall(task.path, command);
            }
        }

        const accountId = target.accountId;
        const cwd = path.resolve(task.path);
        const env = CdkBuildTaskPlugin.GetEnvironmentVariables(target);
        await ChildProcessUtility.SpawnProcessForAccount(cwd, command, accountId, task.taskRoleName, target.region, env, task.logVerbose);
    }

    async appendResolvers(resolver: CfnExpressionResolver, binding: IPluginBinding<ICdkTask>): Promise<void> {
        const { task } = binding;
        const p = await resolver.resolve(task.parameters);
        const collapsed = await resolver.collapse(p);
        const parametersAsString = CdkBuildTaskPlugin.GetParametersAsArgument(collapsed);
        resolver.addResourceWithAttributes('CurrentTask',  { Parameters : parametersAsString });
    }

    static GetEnvironmentVariables(target: IGenericTarget<ICdkTask>): Record<string, string> {
        return {
            // Note: The CDK_DEFAULT_* variables will be overwritten by the cdk cli. Use the
            // CDK_DEPLOY_* variables instead as documented in:
            // https://docs.aws.amazon.com/cdk/latest/guide/environments.html
            CDK_DEFAULT_REGION: target.region,
            CDK_DEFAULT_ACCOUNT: target.accountId,
            CDK_DEPLOY_REGION: target.region,
            CDK_DEPLOY_ACCOUNT: target.accountId,
        };
    }

    getPhysicalIdForCleanup(): string {
        return undefined;
    }

    static GetParametersAsArgument(parameters: Record<string, any>): string {
        if (!parameters) {return '';}
        const entries = Object.entries(parameters);
        return entries.reduce((prev, curr) => prev + ` -c '${curr[0]}=${curr[1]}'`, '');
    }
}


interface ICdkBuildTaskConfig extends IBuildTaskConfiguration {
    Path: string;
    OrganizationBinding: IOrganizationBinding;
    MaxConcurrentTasks?: number;
    FailedTaskTolerance?: number;
    RunNpmInstall?: boolean;
    RunNpmBuild?: boolean;
    CustomDeployCommand?: string;
    CustomRemoveCommand?: string;
    Parameters?: Record<string, ICfnExpression>;
    IgnoreFileChanges?: string | string[];
}

export interface ICdkCommandArgs extends IBuildTaskPluginCommandArgs {
    path: string;
    runNpmInstall: boolean;
    runNpmBuild: boolean;
    customDeployCommand?: string;
    customRemoveCommand?: string;
    parameters?: Record<string, ICfnExpression>;
    ignoreFileChanges?: string[];
}

export interface ICdkTask extends IPluginTask {
    path: string;
    runNpmInstall: boolean;
    runNpmBuild: boolean;
    customDeployCommand?: ICfnExpression;
    customRemoveCommand?: ICfnExpression;
}
