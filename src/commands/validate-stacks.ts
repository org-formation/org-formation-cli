import { Command } from 'commander';
import { CloudFormationBinder } from '../cfn-binder/cfn-binder';
import { CfnTaskRunner } from '../cfn-binder/cfn-task-runner';
import { CfnValidateTaskProvider } from '../cfn-binder/cfn-validate-task-provider';
import { ConsoleUtil } from '../console-util';
import { TemplateRoot } from '../parser/parser';
import { PersistedState } from '../state/persisted-state';
import { BaseCliCommand, ICommandArgs } from './base-command';
import { IUpdateStacksCommandArgs, UpdateStacksCommand } from './update-stacks';

const commandName = 'validate-stacks <templateFile>';
const commandDescription = 'validates the cloudformation templates that will be generated';

export class ValidateStacksCommand extends BaseCliCommand<IUpdateStacksCommandArgs> {

    public static async Perform(command: IUpdateStacksCommandArgs) {
        const x = new ValidateStacksCommand();
        await x.performCommand(command);
    }
    constructor(command?: Command) {
        super(command, commandName, commandDescription, 'templateFile');
    }

    public addOptions(command: Command) {
        super.addOptions(command);
    }

    public async performCommand(command: IUpdateStacksCommandArgs) {
        const templateFile = command.templateFile;
        const template = UpdateStacksCommand.createTemplateUsingOverrides(command, templateFile);
        const state = await this.getState(command);
        const parameters = this.parseStackParameters(command.parameters);
        const cfnBinder = new CloudFormationBinder('validation', template, state, parameters, false);

        const bindings = cfnBinder.enumBindings();

        const validationTaskProvider = new CfnValidateTaskProvider();
        const tasks = validationTaskProvider.enumTasks(bindings);
        await CfnTaskRunner.ValidateTemplates(tasks, command.stackName);
        ConsoleUtil.LogInfo('done');

    }
}
