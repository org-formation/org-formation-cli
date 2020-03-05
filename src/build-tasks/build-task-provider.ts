import path from 'path';
import { ConsoleUtil } from '../console-util';
import { OrgFormationError } from '../org-formation-error';
import { BuildConfiguration, BuildTaskType, IBuildTask, IBuildTaskConfiguration, IIncludeTaskConfiguration, IUpdateOrganizationTaskConfiguration, IUpdateStackTaskConfiguration } from './build-configuration';
import { BuildRunner } from './build-runner';
import { Validator } from '~parser/validator';
import {
    ICommandArgs,
    IUpdateOrganizationCommandArgs,
    IUpdateStacksCommandArgs,
    UpdateOrganizationCommand,
    UpdateStacksCommand,
    ValidateStacksCommand,
} from '~commands/index';


export class BuildTaskProvider {

    public static createValidationTask(configuration: IBuildTaskConfiguration, command: ICommandArgs): IBuildTask {
        switch (configuration.Type) {
            case 'update-stacks':
                return new ValidateStacksTask(configuration as IUpdateStackTaskConfiguration, command);

            case 'update-organization':
                return new ValidateOrganizationTask(configuration as IUpdateOrganizationTaskConfiguration, command);

            case 'include':
                return new ValidateIncludeTask(configuration as IIncludeTaskConfiguration, command);

            default:
                throw new OrgFormationError(`unable to load file ${configuration.FilePath}, unknown configuration type ${configuration.Type}`);
        }
    }

    public static createBuildTask(configuration: IBuildTaskConfiguration, command: ICommandArgs): IBuildTask {
        switch (configuration.Type) {
            case 'update-stacks':
                return new UpdateStacksTask(configuration as IUpdateStackTaskConfiguration, command);

            case 'update-organization':
                return new UpdateOrganizationTask(configuration as IUpdateOrganizationTaskConfiguration, command);

            case 'include':
                return new UpdateIncludeTask(configuration as IIncludeTaskConfiguration, command);

            default:
                throw new OrgFormationError(`unable to load file ${configuration.FilePath}, unknown configuration type ${configuration.Type}`);
        }
    }
}

abstract class BaseIncludeTask implements IBuildTask {
    public name: string;
    public type: BuildTaskType;
    public dependsOn: string[];
    public childTasks: IBuildTask[] = [];
    public taskFilePath: string;
    protected config: IIncludeTaskConfiguration;
    private command: any;

    constructor(config: IIncludeTaskConfiguration, command: ICommandArgs) {
        this.name = config.LogicalName;
        if (config.Path === undefined) {
            throw new OrgFormationError(`Required atrribute Path missing for task ${name}`);
        }
        this.type = config.Type;
        if (typeof config.DependsOn === 'string') {
            this.dependsOn = [config.DependsOn];
        } else {
            this.dependsOn = config.DependsOn;
        }
        this.config = config;
        const dir = path.dirname(config.FilePath);
        this.taskFilePath = path.join(dir, config.Path);
        this.command = command;
        this.childTasks  = this.expandChildTasks(command);
    }

    public isDependency(task: IBuildTask): boolean {
        if (task.type === 'update-organization') {
            return true;
        }
        if (this.dependsOn) {
            return this.dependsOn.includes(task.name);
        }
    }
    public async perform(): Promise<void> {
        await this.innerPerform(this.command);
    }

    protected abstract innerPerform(command: ICommandArgs): Promise<void>;

    protected abstract expandChildTasks(command: ICommandArgs): IBuildTask[];
}

class UpdateIncludeTask extends BaseIncludeTask {

    protected expandChildTasks(command: ICommandArgs): IBuildTask[] {
        const buildConfig = new BuildConfiguration(this.taskFilePath);
        const tasks = buildConfig.enumBuildTasks(command);
        return tasks;
    }

    protected async innerPerform(): Promise<void> {
        ConsoleUtil.LogInfo(`executing: ${this.config.Type} ${this.taskFilePath}`);
        await BuildRunner.RunTasks(this.childTasks, this.config.MaxConcurrentTasks, this.config.FailedTaskTolerance);
    }
}
class ValidateIncludeTask extends BaseIncludeTask {

    protected expandChildTasks(command: ICommandArgs): IBuildTask[] {
        const buildConfig = new BuildConfiguration(this.taskFilePath);
        const tasks = buildConfig.enumValidationTasks(command);
        return tasks;
    }

    protected async innerPerform(): Promise<void> {
        await BuildRunner.RunValidationTasks(this.childTasks, 1, 999);
    }
}

export abstract class BaseStacksTask implements IBuildTask {
    public name: string;
    public type: BuildTaskType;
    public dependsOn: string[];
    public stackName: string;
    public templatePath: string;
    public childTasks: IBuildTask[] = [];
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

export abstract class BaseOrganizationTask implements IBuildTask {
    public name: string;
    public type: BuildTaskType;
    public templatePath: string;
    public childTasks: IBuildTask[] = [];
    protected config: IUpdateOrganizationTaskConfiguration;
    private command: any;

    constructor(config: IUpdateOrganizationTaskConfiguration, command: ICommandArgs) {
        this.name = config.LogicalName;
        this.type = config.Type;
        this.config = config;
        const dir = path.dirname(config.FilePath);
        this.templatePath = path.join(dir, config.Template);
        this.command = command;

    }
    public async perform(): Promise<void> {

        const updateCommand = this.command as IUpdateOrganizationCommandArgs;
        updateCommand.templateFile = this.templatePath;

        await this.innerPerform(updateCommand);
    }

    public isDependency(): boolean {
        return false;
    }

    protected abstract async innerPerform(commandArgs: IUpdateOrganizationCommandArgs): Promise<void>;
}

export class UpdateOrganizationTask extends BaseOrganizationTask {
    protected async innerPerform(commandArgs: IUpdateOrganizationCommandArgs): Promise<void> {
        ConsoleUtil.LogInfo(`executing: ${this.config.Type} ${this.templatePath}`);
        await UpdateOrganizationCommand.Perform(commandArgs);
    }

}

export class ValidateOrganizationTask extends BaseOrganizationTask {
    protected async innerPerform(/* commandArgs: IUpdateOrganizationCommandArgs */): Promise<void> {
        // no op.
    }

}

export class CreateChangeSetOrganizationTask extends BaseOrganizationTask {
    protected innerPerform(/* commandArgs: IUpdateOrganizationCommandArgs */): Promise<void> {
        throw new Error('Method not implemented.');
    }

}

export class ExecuteChangeSetOrganizationTask extends BaseOrganizationTask {
    protected innerPerform(/* commandArgs: IUpdateOrganizationCommandArgs */): Promise<void> {
        throw new Error('Method not implemented.');
    }

}
