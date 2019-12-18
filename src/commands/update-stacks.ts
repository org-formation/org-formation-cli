import { Command } from 'commander';
import { CloudFormationBinder } from '../cfn-binder/cfn-binder';
import { CfnTaskRunner } from '../cfn-binder/cfn-task-runner';
import { ConsoleUtil } from '../console-util';
import { OrgFormationError } from '../org-formation-error';
import { ITemplateOverrides, TemplateRoot } from '../parser/parser';
import { BaseCliCommand, ICommandArgs } from './base-command';

const commandName = 'update-stacks <templateFile>';
const commandDescription = 'update cloudformation resources in accounts';

export class UpdateStacksCommand extends BaseCliCommand<IUpdateStacksCommandArgs> {

    public static async Perform(command: IUpdateStacksCommandArgs) {
        const x = new UpdateStacksCommand();
        await x.performCommand(command);
    }

    constructor(command?: Command) {
        super(command, commandName, commandDescription, 'templateFile');
    }

    public addOptions(command: Command) {
        command.option('--stack-name <stack-name>', 'name of the stack that will be used in cloudformation');
        command.option('--stack-description [description]', 'description of the stack that will be displayed cloudformation');
        command.option('--parameters [parameters]', 'parameter values passed to cloudformation when executing stacks');
        command.option('--termination-protection [termination-protection]', 'value that indicates whether stack must have deletion protection');
        super.addOptions(command);
    }

    public async performCommand(command: IUpdateStacksCommandArgs) {
        if (!command.stackName) {
            throw new OrgFormationError(`argument --stack-name is missing`);
        }
        const stackName = command.stackName;
        const templateFile = command.templateFile;

        const template = this.createTemplateUsingOverrides(command, templateFile);
        const parameters = this.parseStackParameters(command.parameters);
        const state = await this.getState(command);
        const cfnBinder = new CloudFormationBinder(stackName, template, state, parameters, command.terminationProtection);

        const cfnTasks = cfnBinder.enumTasks();
        if (cfnTasks.length === 0) {
            ConsoleUtil.LogInfo(`stack ${stackName} already up to date.`);
        } else {
            await CfnTaskRunner.RunTasks(cfnTasks, stackName);
            ConsoleUtil.LogInfo('done');
        }

        await state.save();
    }

    private createTemplateUsingOverrides(command: IUpdateStacksCommandArgs, templateFile: string) {
        const templateOverrides: ITemplateOverrides = {};

        if (command.stackDescription) {
            templateOverrides.Description = command.stackDescription;
        }
        if (command.organizationBinding) {
            templateOverrides.OrganizationBinding = command.organizationBinding;
        }
        if (command.organizationBindingRegion) {
            templateOverrides.OrganizationBindingRegion = command.organizationBindingRegion;
        }
        if (command.organizationFile) {
            templateOverrides.OrganizationFile = command.organizationFile;
        }
        const template = TemplateRoot.create(templateFile, templateOverrides);
        return template;
    }
}

export interface IUpdateStacksCommandArgs extends ICommandArgs {
    organizationFile?: any;
    organizationBindingRegion?: any;
    organizationBinding?: any;
    templateFile: string;
    stackName: string;
    stackDescription?: string;
    parameters?: string | {};
    terminationProtection?: boolean;
}
