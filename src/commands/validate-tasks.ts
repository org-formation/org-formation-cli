import { Command } from 'commander';
import { BuildConfiguration } from '../build-tasks/build-configuration';
import { BuildRunner } from '../build-tasks/build-runner';
import { BaseCliCommand, ICommandArgs } from './base-command';

const commandName = 'validate-tasks <templateFile>';
const commandDescription = 'Will validate the tasks file, including configured tasks';

export class ValidateTasksCommand extends BaseCliCommand<IValidateTasksCommandArgs> {

    constructor(command?: Command) {
        super(command, commandName, commandDescription, 'tasksFile');
    }

    public addOptions(command: Command) {
        super.addOptions(command);
    }

    public async performCommand(command: IValidateTasksCommandArgs) {
        const tasksFile = command.tasksFile;
        const config = new BuildConfiguration(tasksFile);
        const validationTasks = config.enumValidationTasks(command);
        await BuildRunner.RunValidationTasks(validationTasks, 1, 999);
    }
}

export interface IValidateTasksCommandArgs extends ICommandArgs {
    tasksFile: string;
}
