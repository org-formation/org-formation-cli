
import path from 'path';
import { ConsoleUtil } from '../../util/console-util';
import { IBuildTask, IBuildTaskConfiguration } from '~build-tasks/build-configuration';
import { IPerformTasksCommandArgs, DeleteStacksCommand, IUpdateStacksCommandArgs, UpdateStacksCommand, ValidateStacksCommand, BaseCliCommand } from '~commands/index';
import { Validator } from '~parser/validator';
import { IBuildTaskProvider, BuildTaskProvider } from '~build-tasks/build-task-provider';
import { IOrganizationBinding } from '~parser/parser';


export class UpdateStacksBuildTaskProvider implements IBuildTaskProvider<IUpdateStackTaskConfiguration> {
    public type = 'update-stacks';

    createTask(config: IUpdateStackTaskConfiguration, command: IPerformTasksCommandArgs): IUpdateStacksBuildTask {

        Validator.ValidateUpdateStacksTask(config, config.LogicalName);

        return {
            type: config.Type,
            name: config.LogicalName,
            physicalIdForCleanup: config.StackName,
            StackName: config.StackName,
            childTasks: [],
            isDependency: BuildTaskProvider.createIsDependency(config),
            perform: async (): Promise<void> => {
                const updateStacksCommand = UpdateStacksBuildTaskProvider.createUpdateStacksCommandArgs(config, command);
                ConsoleUtil.LogInfo(`Executing: ${config.Type} ${updateStacksCommand.templateFile} ${updateStacksCommand.stackName}.`);
                await UpdateStacksCommand.Perform(updateStacksCommand);
            },
        };
    }

    createTaskForValidation(config: IUpdateStackTaskConfiguration, command: IPerformTasksCommandArgs): IUpdateStacksBuildTask {
        return {
            type: config.Type,
            name: config.LogicalName,
            childTasks: [],
            StackName: config.StackName,
            isDependency: (): boolean => false,
            perform: async (): Promise<void> => {
                const updateStacksCommand = UpdateStacksBuildTaskProvider.createUpdateStacksCommandArgs(config, command);
                await ValidateStacksCommand.Perform(updateStacksCommand);
            },
        };
    }

    createTaskForCleanup(logicalId: string, physicalId: string, command: IPerformTasksCommandArgs): IBuildTask {
        return {
            type: 'delete-stacks',
            name: logicalId,
            childTasks: [],
            isDependency: (): boolean => false,
            perform: async (): Promise<void> => {
                if (!command.performCleanup) {
                    const additionalArgs = await BaseCliCommand.CreateAdditionalArgsForInvocation();
                    ConsoleUtil.LogWarning('Hi there, it seems you have removed a task!');
                    ConsoleUtil.LogWarning(`The task was called ${logicalId} and used to deploy stacks by name of ${physicalId}.`);
                    ConsoleUtil.LogWarning('By default these stacks don\'t get cleaned up. You can change this by adding the option --perform-cleanup.');
                    ConsoleUtil.LogWarning('You can remove the stacks manually by running the following command:');
                    ConsoleUtil.LogWarning('');
                    ConsoleUtil.LogWarning(`    org-formation delete-stacks --stack-name ${physicalId} ${additionalArgs}`);
                    ConsoleUtil.LogWarning('');
                    ConsoleUtil.LogWarning('Did you not remove a task? but are you logically using different files? check out the --logical-name option.');
                } else {
                    ConsoleUtil.LogInfo(`Executing: delete-stacks ${physicalId}.`);
                    await DeleteStacksCommand.Perform({...command, stackName: physicalId, maxConcurrentStacks: 1, failedStacksTolerance: 0});
                }},
        };
    }

    static createUpdateStacksCommandArgs(config: IUpdateStackTaskConfiguration, command: IPerformTasksCommandArgs): IUpdateStacksCommandArgs {

        const dir = path.dirname(config.FilePath);
        const templatePath = path.join(dir, config.Template);

        const args: IUpdateStacksCommandArgs = {
            ...command,
            stackName: config.StackName,
            templateFile: templatePath,
        };
        if (config.StackDescription) {
            args.stackDescription = config.StackDescription;
        }

        if (config.Parameters) {
            args.parameters = config.Parameters;
        }

        if (config.OrganizationBinding) {
            ConsoleUtil.LogWarning(`task ${this.name} specifies an attribute OrganizationBinding which is deprecated. use DefaultOrganizationBinding instead`);
            args.defaultOrganizationBinding = config.OrganizationBinding;
        }

        if (config.OrganizationBindingRegion) {
            ConsoleUtil.LogWarning(`task ${this.name} specifies an attribute OrganizationBindingRegion which is deprecated. use DefaultOrganizationBindingRegion instead`);
            args.defaultOrganizationBindingRegion = config.OrganizationBindingRegion;
        }

        if (config.DefaultOrganizationBinding) {
            args.defaultOrganizationBinding = config.DefaultOrganizationBinding;
        }

        if (config.DefaultOrganizationBindingRegion) {
            args.defaultOrganizationBindingRegion = config.DefaultOrganizationBindingRegion;
        }

        if (config.OrganizationBindings) {
            args.organizationBindings = config.OrganizationBindings;
        }

        if (config.OrganizationFile) {
            ConsoleUtil.LogWarning(`task ${this.name} specifies an attribute OrganizationFile which is ignored. The Template specified in the update-organization task is always used as OrganizationFile for update-stacks tasks`);
        }
        if (config.TerminationProtection !== undefined) {
            args.terminationProtection = config.TerminationProtection;
        }

        if (config.MaxConcurrentStacks) {
            args.maxConcurrentStacks = config.MaxConcurrentStacks;
        }

        if (config.FailedStackTolerance) {
            args.failedStacksTolerance = config.FailedStackTolerance;
        }

        if (config.CloudFormationRoleName) {
            args.cloudFormationRoleName = config.CloudFormationRoleName;
        }
        if (config.TaskRoleName) {
            args.taskRoleName = config.TaskRoleName;
        }
        return args;
    }

}

export interface IUpdateStacksBuildTask extends IBuildTask {
    StackName: string;
}

export interface IUpdateStackTaskConfiguration extends IBuildTaskConfiguration {
    Template: string;
    StackName: string;
    StackDescription?: string;
    Parameters?: Record<string, string | object>;
    DeletionProtection?: boolean;
    OrganizationFile?: string;
    OrganizationBinding?: IOrganizationBinding; // old: dont use
    OrganizationBindingRegion?: string | string[]; // old: dont use
    DefaultOrganizationBinding?: IOrganizationBinding;
    DefaultOrganizationBindingRegion?: string | string[];
    OrganizationBindings?: Record<string, IOrganizationBinding>;
    TerminationProtection?: boolean;
    MaxConcurrentStacks: number;
    FailedStackTolerance: number;
    CloudFormationRoleName?: string;
    TaskRoleName?: string;
}
