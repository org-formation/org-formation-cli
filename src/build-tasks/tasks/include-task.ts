import path from 'path';
import { ConsoleUtil } from '../../../src/console-util';
import { OrgFormationError } from '../../../src/org-formation-error';
import { BuildTaskType, IBuildTask, BuildConfiguration, IBuildTaskConfiguration } from '~build-tasks/build-configuration';
import { ICommandArgs } from '~commands/index';
import { BuildRunner } from '~build-tasks/build-runner';
import { IBuildTaskProvider } from '~build-tasks/build-task-provider';

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
            throw new OrgFormationError(`Required atrribute Path missing for task ${this.name}`);
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

export class UpdateIncludeTask extends BaseIncludeTask {

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

export class ValidateIncludeTask extends BaseIncludeTask {

    protected expandChildTasks(command: ICommandArgs): IBuildTask[] {
        const buildConfig = new BuildConfiguration(this.taskFilePath);
        const tasks = buildConfig.enumValidationTasks(command);
        return tasks;
    }

    protected async innerPerform(): Promise<void> {
        await BuildRunner.RunValidationTasks(this.childTasks, 1, 999);
    }
}

export class IncludeTaskProvider implements IBuildTaskProvider<IIncludeTaskConfiguration> {
    public type = 'include';

    createTask(config: IIncludeTaskConfiguration, command: ICommandArgs): IBuildTask {
        return new UpdateIncludeTask(config, command);
    }

    createTaskForValidation(config: IIncludeTaskConfiguration, command: ICommandArgs): IBuildTask | undefined {
        return new ValidateIncludeTask(config, command);
    }

    createTaskForCleanup(): IBuildTask | undefined {
        return undefined;
    }

}
export interface IIncludeTaskConfiguration extends IBuildTaskConfiguration {
    Path: string;
    MaxConcurrentTasks?: number;
    FailedTaskTolerance?: number;
}
