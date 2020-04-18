import { Command } from 'commander';
import { ConsoleUtil } from '../util/console-util';
import { BaseCliCommand } from './base-command';
import { IUpdateStacksCommandArgs, UpdateStacksCommand } from './update-stacks';
import { CloudFormationBinder } from '~cfn-binder/cfn-binder';
import { CfnTaskRunner } from '~cfn-binder/cfn-task-runner';
import { CfnValidateTaskProvider } from '~cfn-binder/cfn-validate-task-provider';

const commandName = 'validate-stacks <templateFile>';
const commandDescription = 'validates the CloudFormation templates that will be generated';

export class ValidateStacksCommand extends BaseCliCommand<IUpdateStacksCommandArgs> {

    public static async Perform(command: IUpdateStacksCommandArgs): Promise<void> {
        const x = new ValidateStacksCommand();
        await x.performCommand(command);
    }
    constructor(command?: Command) {
        super(command, commandName, commandDescription, 'templateFile');
    }

    public addOptions(command: Command): void {
        command.option('--parameters [parameters]', 'parameter values passed to CloudFormation when executing stacks');
        command.option('--stack-name <stack-name>', 'name of the stack that will be used in CloudFormation', 'validation');
        super.addOptions(command);
    }

    public async performCommand(command: IUpdateStacksCommandArgs): Promise<void> {
        const templateFile = command.templateFile;
        const template = UpdateStacksCommand.createTemplateUsingOverrides(command, templateFile);
        const state = await this.getState(command);
        const parameters = this.parseCfnParameters(command.parameters);
        const cfnBinder = new CloudFormationBinder(command.stackName, template, state, parameters, false);

        const bindings = cfnBinder.enumBindings();

        const validationTaskProvider = new CfnValidateTaskProvider();
        const tasks = validationTaskProvider.enumTasks(bindings);
        await CfnTaskRunner.ValidateTemplates(tasks, command.stackName);
        ConsoleUtil.LogInfo('done');

    }
}
