import { Command } from 'commander';
import { CloudFormationBinder } from '../cfn-binder/cfn-binder';
import { CfnTaskRunner } from '../cfn-binder/cfn-task-runner';
import { CfnValidateTaskProvider } from '../cfn-binder/cfn-validate-task-provider';
import { ConsoleUtil } from '../console-util';
import { TemplateRoot } from '../parser/parser';
import { PersistedState } from '../state/persisted-state';
import { BaseCliCommand, ICommandArgs } from './base-command';

const commandName = 'validate-stacks <templateFile>';
const commandDescription = 'validates the cloudformation templates that will be generated';

export class ValidateStacksCommand extends BaseCliCommand<IValidateStacksCommandArgs> {

    constructor(command?: Command) {
        super(command, commandName, commandDescription, 'templateFile');
    }

    public addOptions(command: Command) {
        super.addOptions(command);
    }

    public async performCommand(command: IValidateStacksCommandArgs) {
        const template = TemplateRoot.create(command.templateFile);
        const state = await this.getState(command); 
        const cfnBinder = new CloudFormationBinder('validation', template, state, {}, false);

        const bindings = cfnBinder.enumBindings();
        if (bindings.length === 0) {
            ConsoleUtil.LogInfo(`template not bound to any account.`);
        } else {
            const validationTaskProvider = new CfnValidateTaskProvider();
            const tasks = validationTaskProvider.enumTasks(bindings);
            await CfnTaskRunner.ValidateTemplates(tasks);
            ConsoleUtil.LogInfo('done');
        }
    }
}

export interface IValidateStacksCommandArgs extends ICommandArgs {
    templateFile: string;
}
