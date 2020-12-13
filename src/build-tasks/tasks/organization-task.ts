import path from 'path';
import { ConsoleUtil } from '../../util/console-util';
import { ICommandArgs, IUpdateOrganizationCommandArgs, UpdateOrganizationCommand } from '../../commands/index';
import { IBuildTask, IBuildTaskConfiguration } from '~build-tasks/build-configuration';
import { IBuildTaskProvider } from '~build-tasks/build-task-provider';
import { ValidateOrganizationCommand } from '~commands/validate-organization';

export abstract class BaseOrganizationTask implements IBuildTask {
    public name: string;
    public type: string;
    public skip: boolean;
    public forceDeploy: boolean;
    public taskRoleName: string;
    public templatePath: string;
    public childTasks: IBuildTask[] = [];
    protected config: IUpdateOrganizationTaskConfiguration;
    private command: any;

    constructor(config: IUpdateOrganizationTaskConfiguration, command: ICommandArgs) {
        this.name = config.LogicalName;
        this.type = config.Type;
        this.taskRoleName = config.TaskRoleName;
        this.forceDeploy = config.ForceDeploy === true;
        this.config = config;
        const dir = path.dirname(config.FilePath);
        this.templatePath = path.join(dir, config.Template);
        this.command = command;
        this.skip = config.Skip === true;

    }

    public async perform(): Promise<void> {

        const updateCommand = this.command as IUpdateOrganizationCommandArgs;
        updateCommand.templateFile = this.templatePath;
        updateCommand.forceDeploy = this.forceDeploy;
        updateCommand.taskRoleName = this.taskRoleName;
        await this.innerPerform(updateCommand);
    }

    public isDependency(): boolean {
        return false;
    }

    protected abstract async innerPerform(commandArgs: IUpdateOrganizationCommandArgs): Promise<void>;
}

export class UpdateOrganizationTask extends BaseOrganizationTask {
    protected async innerPerform(commandArgs: IUpdateOrganizationCommandArgs): Promise<void> {
        ConsoleUtil.LogInfo(`Executing: ${this.config.Type} ${this.templatePath}.`);
        await UpdateOrganizationCommand.Perform(commandArgs);
    }

}

export class ValidateOrganizationTask extends BaseOrganizationTask {
    protected async innerPerform(commandArgs: IUpdateOrganizationCommandArgs): Promise<void> {
        ConsoleUtil.LogInfo(`Executing: ${this.config.Type} ${this.templatePath}.`);
        await ValidateOrganizationCommand.Perform(commandArgs);
    }

}
export class UpdateOrganizationTaskProvider implements IBuildTaskProvider<IUpdateOrganizationTaskConfiguration> {
    public type = 'update-organization';

    createTask(config: IUpdateOrganizationTaskConfiguration, command: ICommandArgs): IBuildTask {
        return new UpdateOrganizationTask(config, command);
    }

    createTaskForValidation(config: IUpdateOrganizationTaskConfiguration, command: ICommandArgs): IBuildTask | undefined {
        return new ValidateOrganizationTask(config, command);
    }

    createTaskForPrint(): undefined {
        return undefined;
    }

    createTaskForCleanup(): IBuildTask | undefined {
        return undefined;
    }

}

export interface IUpdateOrganizationTaskConfiguration extends IBuildTaskConfiguration {
    Template: string;
}
