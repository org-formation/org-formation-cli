import { Command } from 'commander';
import { ICommandArgs, BaseCliCommand } from '.';
import { ServerlessComBinder } from '~sls-com/serverless-com-binder';
import { TemplateRoot } from '~parser/parser';
import { SlsTaskRunner } from '~sls-com/serverless-com-task-runner';

export class CleanupCommand extends BaseCliCommand<ICleanupCommandArgs> {

    static async Perform(command: ICleanupCommandArgs): Promise<void> {
        const x = new CleanupCommand();
        await x.performCommand(command);
    }

    public addOptions(command: Command): void {
        super.addOptions(command);
        command.option('--type <type>', 'type of resource that needs to be removed');
        command.option('--name <name>', 'logical name of resource that needs to be removed');
        command.option('--max-concurrent-tasks <max-concurrent-tasks>', 'maximum number of stacks to be executed concurrently', 10);
        command.option('--failed-tasks-tolerance <failed-tasks-tolerance>', 'the number of failed stacks after which execution stops', 10);

    }
    protected async performCommand(command: ICleanupCommandArgs): Promise<void> {

        const state = await this.getState(command);
        const task = {name: command.name, type: command.type, hash: '', stage: '', path: ''};
        const emptyTemplate = TemplateRoot.createEmpty();
        const binder = new ServerlessComBinder(task, state, emptyTemplate, undefined);
        const tasks = binder.enumTasks();

        try {
            await SlsTaskRunner.RunTasks(tasks, command.name, command.maxConcurrentTasks, command.failedTasksTolerance);
        } finally {
            await state.save();
        }

    }
}


interface ICleanupCommandArgs extends ICommandArgs {
    type: string;
    name: string;
    maxConcurrentTasks: number;
    failedTasksTolerance: number;
}
