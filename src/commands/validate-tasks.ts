import { Command } from 'commander';
import { BaseCliCommand } from './base-command';
import { IPerformTasksCommandArgs } from './perform-tasks';
import { BuildConfiguration } from '~build-tasks/build-configuration';
import { BuildRunner } from '~build-tasks/build-runner';

const commandName = 'validate-tasks <templateFile>';
const commandDescription = 'Will validate the tasks file, including configured tasks';

export class ValidateTasksCommand extends BaseCliCommand<IPerformTasksCommandArgs> {

    public static async Perform(command: IPerformTasksCommandArgs): Promise<void> {
        const x = new ValidateTasksCommand();
        await x.performCommand(command);
    }

    constructor(command?: Command) {
        super(command, commandName, commandDescription, 'tasksFile');
    }

    public addOptions(command: Command): void {
        command.option('--organization-file [organization-file]', 'organization file used for organization bindings');

        super.addOptions(command);
    }

    public async performCommand(command: IPerformTasksCommandArgs): Promise<void> {
        const tasksFile = command.tasksFile;
        const config = new BuildConfiguration(tasksFile, command);
        const validationTasks = config.enumValidationTasks(command);
        await BuildRunner.RunValidationTasks(validationTasks, 1, 999);
    }
}
