import path from 'path';
import { ICommandArgs } from '../commands/base-command';
import { IUpdateOrganizationCommandArgs, UpdateOrganizationCommand } from '../commands/update-organization';
import { IUpdateStacksCommandArgs, UpdateStacksCommand } from '../commands/update-stacks';
import { ConsoleUtil } from '../console-util';
import { OrgFormationError } from '../org-formation-error';
import { BuildConfiguration, BuildTaskType, IBuildTask, IBuildTaskConfiguration, IIncludeTaskConfiguration, IUpdateOrganizationTaskConfiguration, IUpdateStackTaskConfiguration } from './build-configuration';
import { BuildRunner } from './build-runner';

export class BuildTaskProvider {

    public static createBuildTask(filePath: string, name: string, configuration: IBuildTaskConfiguration, command: ICommandArgs): IBuildTask {
        switch (configuration.Type) {
            case 'update-stacks':
                return new UpdateStacksTask(filePath, name, configuration as IUpdateStackTaskConfiguration, command);

            case 'update-organization':
                return new UpdateOrganization(filePath, name, configuration as IUpdateOrganizationTaskConfiguration, command);

            case 'include':
                return new IncludeTaskFile(filePath, name, configuration as IIncludeTaskConfiguration, command);

            case 'include-dir':
                throw new OrgFormationError('type include-dir not implemented');

            default:
                throw new OrgFormationError(`unable to load file ${filePath}, unknown configuration type ${configuration.Type}`);
        }
    }
}

class IncludeTaskFile implements IBuildTask {
    public name: string;
    public type: BuildTaskType;
    public dependsOn: string[];
    public taskFilePath: string;
    private command: any;
    private config: IIncludeTaskConfiguration;

    constructor(filePath: string, name: string, config: IIncludeTaskConfiguration, command: ICommandArgs) {
        if (config.Path === undefined) {
            throw new OrgFormationError(`Required atrribute Path missing for task ${name}`);
        }
        this.name = name;
        this.type = config.Type;
        if (typeof config.DependsOn === 'string') {
            this.dependsOn = [config.DependsOn];
        } else {
            this.dependsOn = config.DependsOn;
        }
        this.config = config;
        const dir = path.dirname(filePath);
        this.taskFilePath = path.join(dir, config.Path);
        this.command = command;
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
        ConsoleUtil.LogInfo(`executing: ${this.config.Type} ${this.taskFilePath}`);
        const buildConfig = new BuildConfiguration(this.taskFilePath);
        const tasks = buildConfig.enumBuildTasks(this.command);
        await BuildRunner.RunTasks(tasks, this.config.MaxConcurrentTasks, this.config.FailedTaskTolerance);
    }

}

class UpdateStacksTask implements IBuildTask {
    public name: string;
    public type: BuildTaskType;
    public dependsOn: string[];
    public stackName: string;
    public templatePath: string;
    private config: IUpdateStackTaskConfiguration;
    private command: any;
    private dir: string;

    constructor(filePath: string, name: string, config: IUpdateStackTaskConfiguration, command: ICommandArgs) {
        if (config.Template === undefined) {
            throw new OrgFormationError(`Required atrribute Template missing for task ${name}`);
        }
        if (config.StackName === undefined) {
            throw new OrgFormationError(`Required atrribute StackName missing for task ${name}`);
        }
        this.name = name;
        if (typeof config.DependsOn === 'string') {
            this.dependsOn = [config.DependsOn];
        } else {
            this.dependsOn = config.DependsOn;
        }
        this.stackName = config.StackName;
        this.type = config.Type;
        this.config = config;
        this.dir = path.dirname(filePath);
        this.templatePath = path.join(this.dir, config.Template);
        this.command = command;

    }
    public async perform(): Promise<void> {
        ConsoleUtil.LogInfo(`executing: ${this.config.Type} ${this.templatePath} ${this.stackName}`);
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
            args.organizationBinding = this.config.OrganizationBinding;
        }

        if (this.config.OrganizationBindingRegion) {
            args.organizationBindingRegion = this.config.OrganizationBindingRegion;
        }

        if (this.config.OrganizationFile) {
            args.organizationFile = path.join(this.dir, this.config.OrganizationFile);
        }
        if (this.config.TerminationProtection !== undefined) {
            args.terminationProtection = this.config.TerminationProtection;
        }

        await UpdateStacksCommand.Perform(args);
    }
    public isDependency(x: IBuildTask) {
        if (x.type === 'update-organization') {
            return true;
        }
        if (this.dependsOn) {
            return this.dependsOn.includes(x.name);
        }
    }
}

class UpdateOrganization implements IBuildTask {
    public name: string;
    public type: BuildTaskType;
    public templatePath: string;
    private config: IUpdateOrganizationTaskConfiguration;
    private command: any;

    constructor(filePath: string, name: string, config: IUpdateOrganizationTaskConfiguration, command: ICommandArgs) {
        this.name = name;
        this.type = config.Type;
        this.config = config;
        const dir = path.dirname(filePath);
        this.templatePath = path.join(dir, config.Template);
        this.command = command;

    }
    public async perform(): Promise<void> {
        ConsoleUtil.LogInfo(`executing: ${this.config.Type} ${this.templatePath}`);

        const updateCommand = this.command as IUpdateOrganizationCommandArgs;
        updateCommand.templateFile = this.templatePath;
        await UpdateOrganizationCommand.Perform(updateCommand);
    }
    public isDependency(task: IBuildTask) {
        return false;
    }
}
