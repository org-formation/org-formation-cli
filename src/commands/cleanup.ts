import { Command } from 'commander';
import { ICommandArgs, BaseCliCommand } from '.';
import { TemplateRoot } from '~parser/parser';
import { DefaultTaskRunner } from '~core/default-task-runner';
import { PluginProvider } from '~plugin/plugin';
import { PluginBinder } from '~plugin/plugin-binder';

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

        const plugin = PluginProvider.GetPlugin(command.type);

        const binder = new PluginBinder<any>(task, state, emptyTemplate, undefined, plugin);
        const tasks = binder.enumTasks();

        try {
            await DefaultTaskRunner.RunTasks(tasks, command.name, command.maxConcurrentTasks, command.failedTasksTolerance);
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
