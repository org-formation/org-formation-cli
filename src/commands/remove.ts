import { Command } from 'commander';
import { ICommandArgs, BaseCliCommand } from '.';
import { TemplateRoot, ITemplate } from '~parser/parser';
import { DefaultTaskRunner } from '~core/default-task-runner';
import { PluginProvider } from '~plugin/plugin';
import { PluginBinder } from '~plugin/plugin-binder';
import { GlobalState } from '~util/global-state';
import { OrgFormationError } from '~org-formation-error';

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
        command.option('--max-concurrent-tasks <max-concurrent-tasks>', 'maximum number of stacks to be executed concurrently', 1);
        command.option('--failed-tasks-tolerance <failed-tasks-tolerance>', 'the number of failed stacks after which execution stops', 0);

    }
    public async performCommand(command: IRemoveCommandArgs): Promise<void> {

        if (!command.type) {
            throw new OrgFormationError('argument --type is missing');
        }

        if (!command.name) {
            throw new OrgFormationError('argument --name is missing');

        }
        const state = await this.getState(command);
        const task = {name: command.name, type: command.type, hash: '', stage: '', path: ''};

        let templateRoot: TemplateRoot;
        const prevTemplate = state.getPreviousTemplate();
        if (prevTemplate) {
            const orgTemplate = JSON.parse(prevTemplate ? prevTemplate : '{}') as ITemplate;
            delete orgTemplate.Resources;
            templateRoot = TemplateRoot.createFromContents(JSON.stringify(orgTemplate), command.devRole);
        } else {
            templateRoot = TemplateRoot.createEmpty();
        }

        GlobalState.Init(state, templateRoot);

        const plugin = PluginProvider.GetPlugin(command.type);

        const binder = new PluginBinder<any>(task, command.logicalName, command.namespace, state, templateRoot, undefined, plugin, command.resolver);
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
