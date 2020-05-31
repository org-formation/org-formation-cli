import { Command } from 'commander';
import { ICommandArgs, BaseCliCommand } from '.';
import { TemplateRoot } from '~parser/parser';
import { DefaultTaskRunner } from '~core/default-task-runner';
import { PluginProvider } from '~plugin/plugin';
import { PluginBinder } from '~plugin/plugin-binder';

const commandName = 'remove';
const commandDescription = 'removes resources deployed using org-formation from target accounts';

export class RemoveCommand extends BaseCliCommand<IRemoveCommandArgs> {

    static async Perform(command: IRemoveCommandArgs): Promise<void> {
        const x = new RemoveCommand();
        await x.performCommand(command);
    }

    constructor(command?: Command) {
        super(command, commandName, commandDescription);
    }

    public addOptions(command: Command): void {
        super.addOptions(command);
        command.option('--logical-name <tasks-logical-name>', 'logical name of the tasks file, allows multiple tasks files to be used together with --perform-cleanup action', 'default');
        command.option('--type <type>', 'type of resource that needs to be removed');
        command.option('--namespace <namespace>', 'namespace of resource that needs to be removed (if any)');
        command.option('--name <name>', 'logical name of resource that needs to be removed');
        command.option('--max-concurrent-tasks <max-concurrent-tasks>', 'maximum number of stacks to be executed concurrently', 10);
        command.option('--failed-tasks-tolerance <failed-tasks-tolerance>', 'the number of failed stacks after which execution stops', 10);

    }
    public async performCommand(command: IRemoveCommandArgs): Promise<void> {

        const state = await this.getState(command);
        const task = {name: command.name, type: command.type, hash: '', stage: '', path: ''};
        const emptyTemplate = TemplateRoot.createEmpty();

        const plugin = PluginProvider.GetPlugin(command.type);

        const binder = new PluginBinder<any>(task, command.logicalName, command.namespace, state, emptyTemplate, undefined, plugin);
        const tasks = binder.enumTasks();

        try {
            await DefaultTaskRunner.RunTasks(tasks, command.name, command.verbose === true, command.maxConcurrentTasks, command.failedTasksTolerance);
        } finally {
            await state.save();
        }

    }
}


export interface IRemoveCommandArgs extends ICommandArgs {
    logicalName: string;
    type: string;
    name: string;
    maxConcurrentTasks: number;
    failedTasksTolerance: number;
    namespace?: string;
}
