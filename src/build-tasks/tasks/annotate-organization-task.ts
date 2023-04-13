import { ConsoleUtil } from '../../util/console-util';
import { AnnotateOrganizationCommand, IAnnotateOrganizationCommandArgs } from './annotate-organization';
import { IBuildTask, IBuildTaskConfiguration } from '~build-tasks/build-configuration';
import { IBuildTaskProvider } from '~build-tasks/build-task-provider';
import { OrgFormationError } from '~org-formation-error';

export abstract class BaseOrganizationTask implements IBuildTask {
    public name: string;
    public type: string;
    public skip: boolean;
    public forceDeploy: boolean;
    public taskRoleName: string;
    public taskViaRoleArn: string;
    public templatePath: string;
    public templatingContext?: any;
    public childTasks: IBuildTask[] = [];
    protected config: IAnnotateOrganizationTaskConfiguration;
    private command: any;

    constructor(config: IAnnotateOrganizationTaskConfiguration, command: IAnnotateOrganizationCommandArgs) {
        this.name = config.LogicalName;
        this.type = config.Type;
        this.taskRoleName = config.TaskRoleName;
        this.forceDeploy = config.ForceDeploy === true;
        this.templatingContext = config.TemplatingContext ?? command.TemplatingContext;
        this.config = config;

        this.command = command;
        this.skip = config.Skip === true;
        if (typeof config.TaskRoleName !== 'string' && typeof config.TaskRoleName !== 'undefined') {
            throw new OrgFormationError(`annotate-organization TaskViaRoleName attribute must be string, found: ${typeof config.TaskRoleName}`);
        }
        if (config.TaskViaRoleArn !== undefined) {
            throw new OrgFormationError('annotate-organization task does not support TaskViaRoleArn attribute');
        }
    }

    public async perform(): Promise<void> {
        const annotateCommand = this.command as IAnnotateOrganizationCommandArgs;
        annotateCommand.defaultOrganizationAccessRoleName = this.config.DefaultOrganizationAccessRoleName;
        annotateCommand.excludeAccounts = (this.config.ExcludeAccounts ?? []).join(',');
        annotateCommand.accountMapping = this.config.AccountMapping;
        annotateCommand.organizationalUnitMapping = this.config.OrganizationalUnitMapping;
        annotateCommand.TemplatingContext = this.templatingContext;

        await this.innerPerform(annotateCommand);
    }

    public isDependency(): boolean {
        return false;
    }

    protected abstract innerPerform(commandArgs: IAnnotateOrganizationCommandArgs): Promise<void>;
}

export class AnnotateOrganizationTask extends BaseOrganizationTask {
    protected async innerPerform(commandArgs: IAnnotateOrganizationCommandArgs): Promise<void> {
        ConsoleUtil.LogInfo(`Executing: ${this.config.Type} ${this.templatePath}.`);
        await AnnotateOrganizationCommand.Perform(commandArgs);
    }
}

export class ValidateAnnotateOrganizationTask extends BaseOrganizationTask {
    protected async innerPerform(commandArgs: IAnnotateOrganizationCommandArgs): Promise<void> {
        ConsoleUtil.LogInfo(`Executing: ${this.config.Type} ${this.templatePath}.`);
        return;// todo: ValidateOrganizationCommand.Perform(commandArgs);
    }

}
export class AnnotatedOrganizationTaskProvider implements IBuildTaskProvider<IAnnotateOrganizationTaskConfiguration> {
    public type = 'annotate-organization';

    createTask(config: IAnnotateOrganizationTaskConfiguration, command: IAnnotateOrganizationCommandArgs): IBuildTask {
        return new AnnotateOrganizationTask(config, command);
    }

    createTaskForValidation(config: IAnnotateOrganizationTaskConfiguration, command: IAnnotateOrganizationCommandArgs): IBuildTask | undefined {
        return new ValidateAnnotateOrganizationTask(config, command);
    }

    createTaskForPrint(config: IAnnotateOrganizationTaskConfiguration, command: IAnnotateOrganizationCommandArgs): IBuildTask {
        return new ValidateAnnotateOrganizationTask(config, command);
    }

    createTaskForCleanup(): IBuildTask | undefined {
        return undefined;
    }
}

export interface IAnnotateOrganizationTaskConfiguration extends IBuildTaskConfiguration {
    Template: string;
    TemplatingContext?: {};
    templatingContextFile?: string;
    DefaultOrganizationAccessRoleName?: string;
    ExcludeAccounts?: string[];
    AccountMapping?: Map<string, string>;
    OrganizationalUnitMapping?: Map<string, string>;
}
