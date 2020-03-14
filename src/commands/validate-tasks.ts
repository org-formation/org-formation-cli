import { Command } from 'commander';
import { BaseCliCommand, ICommandArgs } from './base-command';
import { BuildConfiguration } from '~build-tasks/build-configuration';
import { BuildRunner } from '~build-tasks/build-runner';

const commandName = 'validate-tasks <templateFile>';
const commandDescription = 'Will validate the tasks file, including configured tasks';

export class ValidateTasksCommand extends BaseCliCommand<IValidateTasksCommandArgs> {

    public static async Perform(command: IValidateTasksCommandArgs): Promise<void> {
        const x = new ValidateTasksCommand();
        await x.performCommand(command);
    }

    constructor(command?: Command) {
        super(command, commandName, commandDescription, 'tasksFile');
    }

    public addOptions(command: Command): void {
        super.addOptions(command);
    }

    public async performCommand(command: IValidateTasksCommandArgs): Promise<void> {
        const tasksFile = command.tasksFile;
        const config = new BuildConfiguration(tasksFile);
        const validationTasks = config.enumValidationTasks(command);
        await BuildRunner.RunValidationTasks(validationTasks, 1, 999);
    }
}

export interface IValidateTasksCommandArgs extends ICommandArgs {
    tasksFile: string;
}
