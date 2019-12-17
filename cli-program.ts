import { Command } from 'commander';
import { CreateChangeSetCommand } from './src/commands/create-organization-changeset';
import { DeleteStacksCommand } from './src/commands/delete-stacks';
import { DescribeStacksCommand } from './src/commands/describe-stacks';
import { ExecuteChangeSetCommand } from './src/commands/execute-organization-changeset';
import { InitOrganizationCommand } from './src/commands/init-organization';
import { InitPipelineCommand } from './src/commands/init-organization-pipeline';
import { PerformTasksCommand } from './src/commands/perform-tasks';
import { PrintStacksCommand } from './src/commands/print-stacks';
import { UpdateOrganizationCommand } from './src/commands/update-organization';
import { UpdateStacksCommand } from './src/commands/update-stacks';

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
        new PrintStacksCommand(this.program);
        new UpdateOrganizationCommand(this.program);
        new UpdateStacksCommand(this.program);

    }

    public getCommand(): Command {
        return this.program;
    }
}
