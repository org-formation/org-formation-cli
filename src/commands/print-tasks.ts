import { Command } from 'commander';
import { BaseCliCommand } from './base-command';
import { IPerformTasksCommandArgs } from './perform-tasks';
import { IPrintStacksCommandArgs } from './print-stacks';
import { BuildConfiguration } from '~build-tasks/build-configuration';
import { BuildRunner } from '~build-tasks/build-runner';
import { Validator } from '~parser/validator';
import { AwsUtil } from '~util/aws-util';
import { ConsoleUtil } from '~util/console-util';

const commandName = 'print-tasks <tasksFile>';
const commandDescription = 'Will print out all cloudformation templates that will be deployed by tasksFile';

export class PrintTasksCommand extends BaseCliCommand<IPrintTasksCommandArgs> {

    public static async Perform(command: IPrintTasksCommandArgs): Promise<void> {
        const x = new PrintTasksCommand();
        await x.performCommand(command);
    }

    constructor(command?: Command) {
        super(command, commandName, commandDescription, 'tasksFile');
    }

    public addOptions(command: Command): void {
        command.option('--max-concurrent-tasks <max-concurrent-tasks>', 'maximum number of tasks to be executed concurrently', 1);
        command.option('--max-concurrent-stacks <max-concurrent-stacks>', 'maximum number of stacks (within a task) to be executed concurrently', 1);
        command.option('--failed-tasks-tolerance <failed-tasks-tolerance>', 'the number of failed tasks after which execution stops', 99);
        command.option('--failed-stacks-tolerance <failed-stacks-tolerance>', 'the number of failed stacks (within a task) after which execution stops', 0);
        command.option('--organization-file [organization-file]', 'organization file used for organization bindings');
        command.option('--parameters [parameters]', 'parameters used when creating build tasks from tasks file');
        command.option('--output <output>', 'the serialization format used when printing stacks. Either json or yaml.', 'yaml');
        command.option('--output-path <output-path>', 'path, within the root directory, used to store printed templates', './.printed-stacks/');
        command.option('--output-cross-account-exports <output-path>', 'when set, output well generate cross account exports as part of cfn parameter', false);
        command.option('--no-print-parameters', 'will not print parameter files when printing stacks');
        command.option('--debug-templating [debug-templating]', 'when set to true the output of text templating processes will be stored on disk', false);
        command.option('--templating-context-file [templating-context-file]', 'json file used as context for nunjuck text templating of organization and tasks file');
        command.option('--dev', 'use development settings, e.g. DefaultDevelopmentBuildAccessRoleName instead of DefaultBuildAccessRoleName', false);
        command.option('--match [match]', 'glob pattern used to define/filter which tasks to run.');

        super.addOptions(command);
    }

    public async performCommand(command: IPerformTasksCommandArgs): Promise<void> {
        const tasksFile = command.tasksFile;

        if (command.dev) {
            AwsUtil.SetIsDevelopmentBuild(true);
        }

        Validator.validatePositiveInteger(command.maxConcurrentStacks, 'maxConcurrentStacks');
        Validator.validatePositiveInteger(command.failedStacksTolerance, 'failedStacksTolerance');
        Validator.validatePositiveInteger(command.maxConcurrentTasks, 'maxConcurrentTasks');
        Validator.validatePositiveInteger(command.failedTasksTolerance, 'failedTasksTolerance');
        this.loadTemplatingContext(command);

        if (command.masterAccountId !== undefined) {
            AwsUtil.SetMasterAccountId(command.masterAccountId);
        }

        command.parsedParameters = this.parseCfnParameters(command.parameters);
        const config = new BuildConfiguration(tasksFile, command.parsedParameters, command.TemplatingContext);
        await config.fixateOrganizationFile(command);

        const printTasks = config.enumPrintTasks(command);

        if (command.match) {
            const skippedTasks = this.skipNonMatchingLeafTasks(printTasks, command.match, '');
            if (skippedTasks === printTasks.length) {
                ConsoleUtil.LogWarning(`--match parameter glob '${command.match}' did not match any tasks. Use --verbose to see the tasks it did not match`);
            }
        }

        await BuildRunner.RunPrintTasks(printTasks, command.verbose === true, command.maxConcurrentTasks, command.failedTasksTolerance);
    }
}

export interface IPrintTasksCommandArgs extends IPerformTasksCommandArgs, IPrintStacksCommandArgs {

}
