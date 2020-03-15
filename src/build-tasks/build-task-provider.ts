import path from 'path';
import { ConsoleUtil } from '../console-util';
import { OrgFormationError } from '../org-formation-error';
import { BuildConfiguration, BuildTaskType, IBuildTask, IBuildTaskConfiguration, IIncludeTaskConfiguration, IUpdateOrganizationTaskConfiguration, IUpdateStackTaskConfiguration, IServerlessComTaskConfiguration } from './build-configuration';
import { BuildRunner } from './build-runner';
import { Validator } from '~parser/validator';
import { ITrackedTask } from '~state/persisted-state';
import {
    ICommandArgs,
    IUpdateOrganizationCommandArgs,
    IUpdateStacksCommandArgs,
    UpdateOrganizationCommand,
    UpdateStacksCommand,
    ValidateStacksCommand,
    IPerformTasksCommandArgs,
    DeleteStacksCommand,
    UpdateSlsCommand,
    IUpdateSlsCommandArgs,
    DeleteSlsCommand,
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

            case 'update-serverless.com':
                return new ValidateServerlessComTask(configuration as IServerlessComTaskConfiguration, command);

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

            case 'update-serverless.com':
                return new UpdateServerlessComTask(configuration as IServerlessComTaskConfiguration, command);

            default:
                throw new OrgFormationError(`unable to load file ${configuration.FilePath}, unknown configuration type ${configuration.Type}`);
        }
    }

    public static createDeleteTask(logicalId: string, type: string, physicalId: string, command: ICommandArgs): IBuildTask | undefined {
        switch (type) {
            case 'update-stacks':
                return new DeleteStacksTask(logicalId, physicalId, command);

            case 'update-serverless.com':
                return new DeleteServerlessOrgTask(logicalId, physicalId, command);
        }

        return undefined;
    }

    public static enumTasksForCleanup(previouslyTracked: ITrackedTask[], tasks: IBuildTask[], command: ICommandArgs): IBuildTask[] {
        const result: IBuildTask[] = [];
        const currentTasks = BuildTaskProvider.recursivelyFilter(tasks, t => t.physicalIdForCleanup !== undefined);
        const physicalIds = currentTasks.map(x=>x.physicalIdForCleanup);
        for(const tracked of previouslyTracked) {
            if (!physicalIds.includes(tracked.physicalIdForCleanup)) {
                const deleteTask = this.createDeleteTask(tracked.logicalName, tracked.type, tracked.physicalIdForCleanup, command);
                if (deleteTask !== undefined) {
                    result.push(deleteTask);
                }
            }
        }
        return result;
    }

    public static recursivelyFilter(tasks: IBuildTask[], filter: (task: IBuildTask) => boolean): IBuildTask[] {
        const result = tasks.filter(filter);
        const tasksWithChildren = tasks.filter(x => x.childTasks && x.childTasks.length > 0);
        const childrenFlattened = tasksWithChildren.reduce((acc: IBuildTask[], x: IBuildTask)=> acc.concat(...x.childTasks), []);
        if (childrenFlattened.length > 0) {
            const resultFromChildren = BuildTaskProvider.recursivelyFilter(childrenFlattened, filter);
            return result.concat(resultFromChildren);
        }
        return result;
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


abstract class BaseServerlessComTask implements IBuildTask {
    public name: string;
    public type: BuildTaskType;
    public dependsOn: string[];
    public childTasks: IBuildTask[] = [];
    public taskFilePath: string;
    public slsPath: string;
    protected config: IServerlessComTaskConfiguration;
    public physicalIdForCleanup?: string = undefined;
    private command: any;

    constructor(config: IServerlessComTaskConfiguration, command: ICommandArgs) {
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
        this.slsPath = path.join(dir, config.Path);
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
        await this.innerPerform(this.command);
    }

    protected abstract innerPerform(command: ICommandArgs): Promise<void>;

}

class UpdateServerlessComTask extends BaseServerlessComTask {

    constructor(config: IServerlessComTaskConfiguration, command: ICommandArgs) {
        super(config, command);
        this.physicalIdForCleanup = config.LogicalName;
    }

    protected async innerPerform(command: ICommandArgs): Promise<void> {
        ConsoleUtil.LogInfo(`executing: ${this.config.Type} ${this.taskFilePath}`);

        const updateSlsCommand: IUpdateSlsCommandArgs = {
            ...command,
            name: this.config.LogicalName,
            stage: this.config.Stage,
            path: this.slsPath,
            failedTolerance: this.config.FailedTaskTolerance,
            maxConcurrent: this.config.MaxConcurrentTasks,
            organizationBinding: this.config.OrganizationBinding,
        };

        await UpdateSlsCommand.Perform(updateSlsCommand);
    }
}

class ValidateServerlessComTask extends BaseServerlessComTask {

    public async innerPerform(): Promise<void> {
        // no-op
    }
}

export class DeleteServerlessOrgTask implements IBuildTask {
    name: string;
    type: BuildTaskType = 'delete-serverless.com';
    childTasks: IBuildTask[] = [];
    physicalIdForCleanup?: string = undefined;
    command: ICommandArgs;

    constructor(logicalId: string, physicalId: string, command: ICommandArgs) {
        this.name = physicalId;
        this.command = command;
    }

    isDependency(): boolean {
        return false;
    }

    async perform(): Promise<void> {
        await DeleteSlsCommand.Perform({ ...this.command,  name: this.name, maxConcurrentStacks: 10, failedStacksTolerance: 10 });
    }

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
