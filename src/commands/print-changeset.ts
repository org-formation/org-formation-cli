import { Command } from 'commander';
import { ConsoleUtil } from '../util/console-util';
import { BaseCliCommand, ICommandArgs } from './base-command';
import { TemplateRoot } from '~parser/parser';
import { ChangeSetProvider } from '~change-set/change-set-provider';
import { GlobalState } from '~util/global-state';
import { yamlDump } from '~yaml-cfn/index';

const commandName = 'print-change-set <change-set-name>';
const commandDescription = 'outputs change set details';

export class PrintChangeSetCommand extends BaseCliCommand<IPrintChangeSetCommandArgs> {

    public static async Perform(command: IPrintChangeSetCommandArgs): Promise<void> {
        const x = new PrintChangeSetCommand();
        await x.performCommand(command);
    }

    constructor(command?: Command) {
        super(command, commandName, commandDescription, 'changeSetName');
    }

    public addOptions(command: Command): void {
        super.addOptions(command);
        command.option('--change-set-name [change-set-name]', 'change set name');
        command.option('--output <output>', 'serialization format used when printing change set. Either json or yaml.', 'json');
    }

    public async performCommand(command: IPrintChangeSetCommandArgs): Promise<void> {
        if (!['json', 'yaml'].includes(command.output)) {
            ConsoleUtil.LogError(`Invalid output format '${command.output}'. Must be either 'json' or 'yaml'.`);
            return;
        }
        const changeSetName = command.changeSetName;
        const stateBucketName = await BaseCliCommand.GetStateBucketName(command.stateBucketName);
        const provider = new ChangeSetProvider(stateBucketName);
        const changeSetObj = await provider.getChangeSet(changeSetName);
        if (!changeSetObj) {
            ConsoleUtil.LogError(`change set '${changeSetName}' not found.`);
            return;
        }
        const changeSet = changeSetObj.changeSet;

        if (command.output === 'json') {
            ConsoleUtil.Out(JSON.stringify(changeSet, null, 2));
        } else if (command.output === 'yaml') {
            ConsoleUtil.Out(yamlDump(changeSet));
        }

    }
}

export interface IPrintChangeSetCommandArgs extends ICommandArgs {
    changeSetName?: string;
    output?: 'json' | 'yaml';
}
