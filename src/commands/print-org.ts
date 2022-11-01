import { Command } from 'commander';
import { ConsoleUtil } from '../util/console-util';
import { BaseCliCommand, ICommandArgs } from './base-command';
import { TemplateRoot } from '~parser/parser';
import { yamlDump } from '~yaml-cfn/index';


const commandName = 'print-org <templateFile>';
const commandDescription = 'outputs organization template file';

export class PrintOrganizationCommand extends BaseCliCommand<IPrintOrganizationCommandArgs> {

    public static async Perform(command: IPrintOrganizationCommandArgs): Promise<void> {
        const x = new PrintOrganizationCommand();
        await x.performCommand(command);
    }

    constructor(command?: Command) {
        super(command, commandName, commandDescription, 'templateFile');
    }

    public addOptions(command: Command): void {
        command.option('--debug-templating [debug-templating]', 'when set to true the output of text templating processes will be stored on disk', false);
        command.option('--output <output>', 'the serialization format used when printing stacks. Either json or yaml.', 'yaml');
        super.addOptions(command);
    }

    public async performCommand(command: IPrintOrganizationCommandArgs): Promise<void> {

        const template = await TemplateRoot.create(command.templateFile, { TemplatingContext: command.TemplatingContext });

        if (command.output === 'json') {
            ConsoleUtil.Out(template.source);
        } else {
            ConsoleUtil.Out(yamlDump(template.contents));
        }
    }
}

export interface IPrintOrganizationCommandArgs extends ICommandArgs {
    templateFile: string;
    TemplatingContext?: {};
    templatingContextFile?: string;
    debugTemplating?: boolean;
    output?: 'json' | 'yaml';
}
