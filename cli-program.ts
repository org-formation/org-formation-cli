import { Command } from 'commander';
import {
    CreateChangeSetCommand,
    DeleteStacksCommand,
    DescribeStacksCommand,
    ExecuteChangeSetCommand,
    InitOrganizationCommand,
    InitPipelineCommand,
    PerformTasksCommand,
    PrintStacksCommand,
    UpdateOrganizationCommand,
    UpdateStacksCommand,
    ValidateStacksCommand,
    ValidateTasksCommand,
    RemoveCommand,
} from '~commands/index';
import { PrintTasksCommand } from '~commands/print-tasks';

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

    constructor() {
        this.program = new Command();
        this.program.version(CliProgram.GetVersion(), '-v, --version');
        this.program.description('aws organization formation');

        new CreateChangeSetCommand(this.program);
        new DeleteStacksCommand(this.program);
        new DescribeStacksCommand(this.program);
        new ExecuteChangeSetCommand(this.program);
        new InitPipelineCommand(this.program);
        new InitOrganizationCommand(this.program);
        new PerformTasksCommand(this.program);
        new PrintTasksCommand(this.program);
        new PrintStacksCommand(this.program);
        new UpdateOrganizationCommand(this.program);
        new UpdateStacksCommand(this.program);

        new ValidateStacksCommand(this.program);
        new ValidateTasksCommand(this.program);
        new RemoveCommand(this.program);
    }

    public getCommand(): Command {
        return this.program;
    }
}
