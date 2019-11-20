import { Command } from 'commander';
import { createChangeSet, deleteAccountStacks, describeAccountStacks, executeChangeSet, generateTemplate, performTasks, printAccountStacks, updateAccountResources, updateTemplate } from './index';

export class CliProgram {

    public static Create(): Command {
        const p = new CliProgram();
        return p.getCommand();
    }

    private static GetVersion(): string {
        let pjson;
        try {
            pjson = require('../package.json');
        } catch (err) {
            pjson = require('./package.json');
        }
        return pjson.version;
    }

    public commandNames: string[];

    private readonly program: Command;
    private readonly init: Command;
    private readonly update: Command;
    private readonly createChangeSet: Command;
    private readonly executeChangeSet: Command;
    private readonly updateStacks: Command;
    private readonly describeStacks: Command;
    private readonly deleteStacks: Command;
    private readonly performTasks: Command;
    private readonly printStacks: Command;

    constructor() {
        this.program = new Command();
        this.program.version(CliProgram.GetVersion(), '-v, --version');
        this.program.description('aws organization formation');

        this.init = this.program.command('init <outFile>');
        this.init.description('generate template & initialize organization');

        this.update = this.program.command('update <templateFile>');
        this.update.description('update organization resources');

        this.createChangeSet = this.program.command('create-change-set <templateFile>');
        this.createChangeSet.description('create change set that can be reviewed and executed later');

        this.executeChangeSet = this.program.command('execute-change-set <change-set-name>');
        this.executeChangeSet.description('execute previously created change set');

        this.updateStacks = this.program.command('update-stacks <templateFile>');
        this.updateStacks.description('update cloudformation resources in accounts');

        this.describeStacks = this.program.command('describe-stacks');
        this.describeStacks.description('list all stacks deployed to accounts using org-formation');

        this.deleteStacks = this.program.command('delete-stacks <stack-name>');
        this.deleteStacks.description('removes all stacks deployed to accounts using org-formation');

        this.printStacks = this.program.command('print-stacks <templateFile>');
        this.printStacks.description('removes all stacks deployed to accounts using org-formation');

        this.performTasks = this.program.command('perform-tasks <path>');
        this.performTasks.description('performs all tasks from either a file or directory structure');

        const allCommands = this.program.commands;
       // this.commandNames = allCommands.Map((x) => x.name);

        this.addProfileFlag(allCommands);
        this.addStateBucketFlags(allCommands);
        this.addStateBucketRegionFlag([this.init]);
        this.addStackNameFlagForDescribe([this.describeStacks]);
        this.addStackNameFlagForUpdate([this.updateStacks, this.printStacks]);
        this.addChangeSetFlag([this.createChangeSet]);

        this.init.action(async (outFile, cmd) => await generateTemplate(outFile, cmd));

        this.update.action(async (templateFile, cmd) => await updateTemplate(templateFile, cmd));
        this.createChangeSet.action(async (templateFile, cmd) => await createChangeSet(templateFile, cmd));
        this.executeChangeSet.action(async (templateFile, cmd) => await executeChangeSet(templateFile, cmd));

        this.updateStacks.action(async (templateFile, cmd) => await updateAccountResources(templateFile, cmd));
        this.describeStacks.action(async (cmd) => await describeAccountStacks(cmd));
        this.deleteStacks.action(async (stackName, cmd) => await deleteAccountStacks(stackName, cmd));
        this.performTasks.action(async (path, cmd) => await performTasks(path, cmd));
        this.printStacks.action(async (templateFile, cmd) => await printAccountStacks(templateFile, cmd));
    }

    public getCommand(): Command {
        return this.program;
    }

    private addProfileFlag(commands: Command[]) {
        for (const command of commands) {
            command.option('--profile [profile]', 'aws profile to use');
        }
    }

    private addStateBucketFlags(commands: Command[]) {
        for (const command of commands) {
            command.option('--state-bucket-name [state-bucket-name]', 'bucket name that contains state file', 'organization-formation-${AWS::AccountId}');
            command.option('--state-object [state-object]', 'key for object used to store state', 'state.json');
        }
    }

    private addStateBucketRegionFlag(commands: Command[]) {
        for (const command of commands) {
            command.option('--state-bucket-region [state-bucket-region]', 'region used to created state-bucket in');
        }
    }

    private addStackNameFlagForDescribe(commands: Command[]) {
        for (const command of commands) {
            command.option('--stack-name [stack-name]', 'if specified only returns stacks of stack-name');
        }
    }

    private addStackNameFlagForUpdate(commands: Command[]) {
        for (const command of commands) {
            command.option('--stack-name <stack-name>', 'name of the stack that will be used in cloudformation');
        }
    }
    private addChangeSetFlag(commands: Command[]) {
        for (const command of commands) {
            command.option('--change-set-name [change-set-name]', 'change set name');
        }
    }
}
