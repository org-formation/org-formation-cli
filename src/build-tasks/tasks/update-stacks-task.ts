
import path from 'path';
import { ConsoleUtil } from '../../../src/console-util';
import { BuildTaskType, IBuildTask, IBuildTaskConfiguration } from '~build-tasks/build-configuration';
import { ICommandArgs, IPerformTasksCommandArgs, DeleteStacksCommand, IUpdateStacksCommandArgs, UpdateStacksCommand, ValidateStacksCommand } from '~commands/index';
import { Validator } from '~parser/validator';
import { IBuildTaskProvider } from '~build-tasks/build-task-provider';
import { IOrganizationBinding } from '~parser/parser';


export abstract class BaseStacksTask implements IBuildTask {
    public name: string;
    public type: BuildTaskType;
    public dependsOn: string[];
    public stackName: string;
    public templatePath: string;
    public childTasks: IBuildTask[] = [];
    public physicalIdForCleanup?: string = undefined;
    protected config: IUpdateStackTaskConfiguration;
    private command: any;
    private dir: string;

    constructor(config: IUpdateStackTaskConfiguration, command: ICommandArgs) {
        this.name = config.LogicalName;

        Validator.ValidateUpdateStacksTask(config, this.name);

        if (typeof config.DependsOn === 'string') {
            this.dependsOn = [config.DependsOn];
        } else {
            this.dependsOn = config.DependsOn;
        }
        this.stackName = config.StackName;
        this.type = config.Type;
        this.config = config;
        this.dir = path.dirname(config.FilePath);
        this.templatePath = path.join(this.dir, config.Template);
        this.command = command;

    }
    public async perform(): Promise<void> {
        const args: IUpdateStacksCommandArgs = {
            ...this.command,
            stackName: this.stackName,
            templateFile: this.templatePath,
        };
        if (this.config.StackDescription) {
            args.stackDescription = this.config.StackDescription;
        }

        if (this.config.Parameters) {
            args.parameters = this.config.Parameters;
        }

        if (this.config.OrganizationBinding) {
            ConsoleUtil.LogWarning(`task ${this.name} specifies an attribute OrganizationBinding wich is deprecated. use DefaultOrganizationBinding instead`);
            args.defaultOrganizationBinding = this.config.OrganizationBinding;
        }

        if (this.config.OrganizationBindingRegion) {
            ConsoleUtil.LogWarning(`task ${this.name} specifies an attribute OrganizationBindingRegion wich is deprecated. use DefaultOrganizationBindingRegion instead`);
            args.defaultOrganizationBindingRegion = this.config.OrganizationBindingRegion;
        }

        if (this.config.DefaultOrganizationBinding) {
            args.defaultOrganizationBinding = this.config.DefaultOrganizationBinding;
        }

        if (this.config.DefaultOrganizationBindingRegion) {
            args.defaultOrganizationBindingRegion = this.config.DefaultOrganizationBindingRegion;
        }

        if (this.config.OrganizationBindings) {
            args.organizationBindings = this.config.OrganizationBindings;
        }

        if (this.config.OrganizationFile) {
            ConsoleUtil.LogWarning(`task ${this.name} specifies an attribute OrganizationFile which is ingored. The Template specified in the update-organization task is always used as OrganizationFile for update-stacks tasks`);
        }
        if (this.config.TerminationProtection !== undefined) {
            args.terminationProtection = this.config.TerminationProtection;
        }

        if (this.config.MaxConcurrentStacks) {
            args.maxConcurrentStacks = this.config.MaxConcurrentStacks;
        }

        if (this.config.FailedStackTolerance) {
            args.failedStacksTolerance = this.config.FailedStackTolerance;
        }

        await this.innerPerform(args);
    }

    public abstract async innerPerform(args: IUpdateStacksCommandArgs): Promise<void>;

    public isDependency(x: IBuildTask): boolean {
        if (x.type === 'update-organization') {
            return true;
        }
        if (this.dependsOn) {
            return this.dependsOn.includes(x.name);
        }
    }
}

export class UpdateStacksTask extends BaseStacksTask {

    constructor(config: IUpdateStackTaskConfiguration, command: ICommandArgs) {
        super(config, command);
        this.physicalIdForCleanup = config.StackName;
    }

    public async innerPerform(args: IUpdateStacksCommandArgs): Promise<void> {
        ConsoleUtil.LogInfo(`executing: ${this.config.Type} ${this.templatePath} ${this.stackName}`);
        await UpdateStacksCommand.Perform(args);
    }

}

export class ValidateStacksTask extends BaseStacksTask {

    public async innerPerform(args: IUpdateStacksCommandArgs): Promise<void> {
        await ValidateStacksCommand.Perform(args);
    }

}

export class DeleteStacksTask implements IBuildTask {
    name: string;
    stackName: string;
    command: ICommandArgs;
    type: BuildTaskType = 'delete-stacks';
    childTasks: IBuildTask[] = [];
    physicalIdForCleanup?: string = undefined;
    performCleanup = false;

    constructor(logicalName: string, stackName: string, command: ICommandArgs) {
        this.name = logicalName;
        this.stackName = stackName;
        this.command = command;
        this.performCleanup = (command as IPerformTasksCommandArgs).performCleanup;
    }

    isDependency(): boolean {
        return false;
    }

    async perform(): Promise<void> {
        if (!this.performCleanup) {
            ConsoleUtil.LogWarning('Hi there, it seems you have removed a task!');
            ConsoleUtil.LogWarning(`The task was called ${this.name} and used to deploy stacks by name of ${this.stackName}.`);
            ConsoleUtil.LogWarning('By default these stacks dont get cleaned up. You can change this by adding the option --perfom-cleanup.');
            ConsoleUtil.LogWarning('You can remove the stacks manually by running the following command:');
            ConsoleUtil.LogWarning('');
            ConsoleUtil.LogWarning(`    org-formation delete-stacks --stack-name ${this.stackName}`);
            ConsoleUtil.LogWarning('');
            ConsoleUtil.LogWarning('Did you not remove a task? but are you logically using different files? check out the --logical-name option.');
        } else {
            ConsoleUtil.LogInfo(`executing: ${this.type} ${this.stackName}`);
            await DeleteStacksCommand.Perform({...this.command, stackName: this.stackName, maxConcurrentStacks: 1, failedStacksTolerance: 0});
        }
    }


}

export class UpdateStacksBuildTaskProvider implements IBuildTaskProvider<IUpdateStackTaskConfiguration> {
    public type = 'update-stacks';

    createTask(config: IUpdateStackTaskConfiguration, command: ICommandArgs): IBuildTask {
        return new UpdateStacksTask(config, command);
    }

    createTaskForValidation(config: IUpdateStackTaskConfiguration, command: ICommandArgs): IBuildTask | undefined {
        return new ValidateStacksTask(config, command);
    }

    createTaskForCleanup(logicalId: string, physicalId: string, command: ICommandArgs): IBuildTask | undefined {
        return new DeleteStacksTask(logicalId, physicalId, command);
    }

}

export interface IUpdateStackTaskConfiguration extends IBuildTaskConfiguration {
    Template: string;
    StackName?: string;
    StackDescription?: string;
    Parameters?: Record<string, string>;
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

}
