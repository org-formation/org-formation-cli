import { Command } from 'commander';
import { CloudFormationBinder } from '../cfn-binder/cfn-binder';
import { CfnTaskRunner } from '../cfn-binder/cfn-task-runner';
import { ConsoleUtil } from '../console-util';
import { OrgFormationError } from '../org-formation-error';
import { ITemplate, TemplateRoot } from '../parser/parser';
import { BaseCliCommand, ICommandArgs } from './base-command';

const commandName = 'delete-stacks';
const commandDescription = 'removes all stacks deployed to accounts using org-formation';

export class DeleteStacksCommand extends BaseCliCommand<IDeleteStackCommandArgs> {

    constructor(command: Command) {
        super(command, commandName, commandDescription);
    }

    public addOptions(command: Command): void {
        super.addOptions(command);
        command.option('--stack-name <stack-name>', 'name of the stack that will be deleted');
        command.option('--max-concurrent-stacks <max-concurrent-stacks>', 'maximum number of stacks to be executed concurrently', 1);
        command.option('--failed-stacks-tolerance <failed-stacks-tolerance>', 'the number of failed stacks after which execution stops', 0);

    }

    public async performCommand(command: IDeleteStackCommandArgs): Promise<void> {
        if (!command.stackName) {
            throw new OrgFormationError('argument --stack-name is missing');
        }
        const stackName = command.stackName;

        const state = await this.getState(command);
        const orgTemplate = JSON.parse(state.getPreviousTemplate()) as ITemplate;
        delete orgTemplate.Resources;
        const emptyTemplate = TemplateRoot.createFromContents(JSON.stringify(orgTemplate));

        const cfnBinder = new CloudFormationBinder(stackName, emptyTemplate, state);

        const cfnTasks = cfnBinder.enumTasks();
        if (cfnTasks.length === 0) {
            ConsoleUtil.LogInfo('no templates found.');
        } else {
            await CfnTaskRunner.RunTasks(cfnTasks, stackName, command.maxConcurrentStacks, command.failedStacksTolerance);
            ConsoleUtil.LogInfo('done');
        }

        await state.save();
    }
}

interface IDeleteStackCommandArgs extends ICommandArgs {
    stackName: string;
    maxConcurrentStacks: number;
    failedStacksTolerance: number;
}
