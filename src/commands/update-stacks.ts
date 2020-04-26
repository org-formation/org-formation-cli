import { Command } from 'commander';
import { ConsoleUtil } from '../util/console-util';
import { OrgFormationError } from '../org-formation-error';
import { BaseCliCommand, ICommandArgs } from './base-command';
import { CloudFormationBinder } from '~cfn-binder/cfn-binder';
import { CfnTaskRunner } from '~cfn-binder/cfn-task-runner';
import { IOrganizationBinding, ITemplateOverrides, TemplateRoot } from '~parser/parser';
import { Validator } from '~parser/validator';

const commandName = 'update-stacks <templateFile>';
const commandDescription = 'update CloudFormation resources in accounts';

export class UpdateStacksCommand extends BaseCliCommand<IUpdateStacksCommandArgs> {

    public static async Perform(command: IUpdateStacksCommandArgs): Promise<void> {
        const x = new UpdateStacksCommand();
        await x.performCommand(command);
    }

    public static createTemplateUsingOverrides(command: IUpdateStacksCommandArgs, templateFile: string): TemplateRoot {
        const templateOverrides: ITemplateOverrides = {};

        if (command.stackDescription) {
            templateOverrides.Description = command.stackDescription;
        }
        if (command.defaultOrganizationBinding) {
            templateOverrides.DefaultOrganizationBinding = command.defaultOrganizationBinding;
        }
        if (command.defaultOrganizationBindingRegion) {
            templateOverrides.DefaultOrganizationBindingRegion = command.defaultOrganizationBindingRegion;
        }
        if (command.organizationFile) {
            templateOverrides.OrganizationFile = command.organizationFile;
        }
        if (command.organizationFile) {
            templateOverrides.OrganizationBindings = command.organizationBindings;
        }
        if (command.parameters) {
            templateOverrides.ParameterValues = {};
            for(const [key, val] of Object.entries(command.parameters)) {
                templateOverrides.ParameterValues[key] = val;
            }
        }
        const template = TemplateRoot.create(templateFile, templateOverrides, command.organizationFileHash);
        return template;
    }

    constructor(command?: Command) {
        super(command, commandName, commandDescription, 'templateFile');
    }

    public addOptions(command: Command): void {
        command.option('--stack-name <stack-name>', 'name of the stack that will be used in CloudFormation');
        command.option('--stack-description [description]', 'description of the stack that will be displayed CloudFormation');
        command.option('--parameters [parameters]', 'parameter values passed to CloudFormation when executing stacks');
        command.option('--termination-protection', 'value that indicates whether stack must have deletion protection');
        command.option('--max-concurrent-stacks <max-concurrent-stacks>', 'maximum number of stacks to be executed concurrently', 1);
        command.option('--failed-stacks-tolerance <failed-stacks-tolerance>', 'the number of failed stacks after which execution stops', 0);
        super.addOptions(command);
    }

    public async performCommand(command: IUpdateStacksCommandArgs): Promise<void> {
        if (!command.stackName) {
            throw new OrgFormationError('argument --stack-name is missing');
        }
        Validator.validatePositiveInteger(command.maxConcurrentStacks, 'maxConcurrentStacks');
        Validator.validatePositiveInteger(command.failedStacksTolerance, 'failedStacksTolerance');
        Validator.validateBoolean(command.terminationProtection, 'terminationProtection');

        const terminationProtection = command.terminationProtection === true;
        const cloudFormationRoleName = command.cloudFormationRoleName;
        const taskRoleName = command.taskRoleName;
        const stackName = command.stackName;
        const templateFile = command.templateFile;

        const template = UpdateStacksCommand.createTemplateUsingOverrides(command, templateFile);
        const parameters = this.parseCfnParameters(command.parameters);
        const state = await this.getState(command);
        const cfnBinder = new CloudFormationBinder(stackName, template, state, parameters, terminationProtection, taskRoleName, cloudFormationRoleName);

        const cfnTasks = cfnBinder.enumTasks();
        if (cfnTasks.length === 0) {
            ConsoleUtil.LogInfo(`Stack ${stackName} already up to date.`);
        } else {
            try {
                await CfnTaskRunner.RunTasks(cfnTasks, stackName, command.maxConcurrentStacks, command.failedStacksTolerance);
            } finally {
                await state.save();
            }
        }

    }
}

export interface IUpdateStacksCommandArgs extends ICommandArgs {
    organizationFile?: string;
    organizationFileHash?: string;
    defaultOrganizationBindingRegion?: any;
    defaultOrganizationBinding?: any;
    organizationBindings?: Record<string, IOrganizationBinding>;
    templateFile: string;
    stackName: string;
    stackDescription?: string;
    parameters?: string | {};
    terminationProtection?: boolean;
    maxConcurrentStacks: number;
    failedStacksTolerance: number;
    cloudFormationRoleName?: string;
    taskRoleName?: string;
}
