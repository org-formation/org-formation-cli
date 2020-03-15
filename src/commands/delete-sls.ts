import { ICommandArgs, BaseCliCommand, ServerlessGenericTaskType } from '.';
import { ServerlessComBinder } from '~sls-com/serverless-com-binder';
import { TemplateRoot } from '~parser/parser';
import { SlsTaskRunner } from '~sls-com/serverless-com-task-runner';

export class DeleteSlsCommand extends BaseCliCommand<IDeleteSlsCommandArgs> {

    static async Perform(command: IDeleteSlsCommandArgs): Promise<void> {
        const x = new DeleteSlsCommand();
        await x.performCommand(command);
    }

    protected async performCommand(command: IDeleteSlsCommandArgs): Promise<void> {

        const state = await this.getState(command);
        const task = {name: command.name, type: ServerlessGenericTaskType, hash: '', stage: '', path: ''};
        const emptyTemplate = TemplateRoot.createEmpty();
        const binder = new ServerlessComBinder(task, state, emptyTemplate, undefined);
        const tasks = binder.enumTasks();

        try {
            await SlsTaskRunner.RunTasks(tasks, command.name, 10, 10);
        } finally {
            await state.save();
        }

    }
}


interface IDeleteSlsCommandArgs extends ICommandArgs {
    name: string;
    maxConcurrentStacks: number;
    failedStacksTolerance: number;
}
