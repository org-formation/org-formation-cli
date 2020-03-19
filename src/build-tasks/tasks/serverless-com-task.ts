import path from 'path';
import { ConsoleUtil } from '../../../src/console-util';
import { OrgFormationError } from '../../../src/org-formation-error';
import { BuildTaskType, IBuildTask, IBuildTaskConfiguration } from '~build-tasks/build-configuration';
import { ICommandArgs, IUpdateSlsCommandArgs, UpdateSlsCommand, IPerformTasksCommandArgs, ServerlessGenericTaskType, CleanupCommand} from '~commands/index';
import { IOrganizationBinding } from '~parser/parser';
import { IBuildTaskProvider } from '~build-tasks/build-task-provider';


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

export class UpdateServerlessComTask extends BaseServerlessComTask {

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

export class DeleteServerlessOrgTask implements IBuildTask {
    name: string;
    type: BuildTaskType = 'delete-serverless.com';
    childTasks: IBuildTask[] = [];
    physicalIdForCleanup?: string = undefined;
    command: ICommandArgs;
    performCleanup = false;

    constructor(logicalId: string, physicalId: string, command: ICommandArgs) {
        this.name = physicalId;
        this.command = command;
        this.performCleanup = (command as IPerformTasksCommandArgs).performCleanup;
    }

    isDependency(): boolean {
        return false;
    }

    async perform(): Promise<void> {
        if (!this.performCleanup) {
            ConsoleUtil.LogWarning('Hi there, it seems you have removed a task!');
            ConsoleUtil.LogWarning(`The task was called ${this.name} and used to deploy a serverless.com project.`);
            ConsoleUtil.LogWarning('By default these tasks dont get cleaned up. You can change this by adding the option --perfom-cleanup.');
            ConsoleUtil.LogWarning('You can remove the project manually by running the following command:');
            ConsoleUtil.LogWarning('');
            ConsoleUtil.LogWarning(`    org-formation cleanup --type ${ServerlessGenericTaskType} --name ${this.name}`);
            ConsoleUtil.LogWarning('');
            ConsoleUtil.LogWarning('Did you not remove a task? but are you logically using different files? check out the --logical-name option.');
        } else {
            ConsoleUtil.LogInfo(`executing: ${this.type} ${this.name}`);
            await CleanupCommand.Perform({ ...this.command,  name: this.name, type: ServerlessGenericTaskType, maxConcurrentTasks: 10, failedTasksTolerance: 10 });
        }
    }

}

export class UpdateServerlessComBuildTaskProvider implements IBuildTaskProvider<IServerlessComTaskConfiguration> {
    public type = 'update-serverless.com';

    createTask(config: IServerlessComTaskConfiguration, command: ICommandArgs): IBuildTask {
        return new UpdateServerlessComTask(config, command);
    }

    createTaskForValidation(): IBuildTask | undefined {
        return undefined;
    }

    createTaskForCleanup(logicalId: string, physicalId: string, command: ICommandArgs): IBuildTask | undefined {
        return new DeleteServerlessOrgTask(logicalId, physicalId, command);
    }
}

export interface IServerlessComTaskConfiguration extends IBuildTaskConfiguration {
    Path: string;
    Config?: string;
    Stage?: string;
    OrganizationBinding: IOrganizationBinding;
    MaxConcurrentTasks?: number;
    FailedTaskTolerance?: number;
}
