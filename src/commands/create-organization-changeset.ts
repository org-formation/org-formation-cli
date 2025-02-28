import { Command } from 'commander';
import { ConsoleUtil } from '../util/console-util';
import { BaseCliCommand, ICommandArgs } from './base-command';
import { ChangeSetProvider } from '~change-set/change-set-provider';
import { TemplateRoot } from '~parser/parser';
import { GlobalState } from '~util/global-state';
import { AwsUtil } from '~util/aws-util';
import { yamlDump } from '~yaml-cfn/index';

const commandName = 'create-change-set <templateFile>';
const commandDescription = 'create change set that can be reviewed and executed later';

export class CreateChangeSetCommand extends BaseCliCommand<ICreateChangeSetCommandArgs> {

    constructor(command: Command) {
        super(command, commandName, commandDescription, 'templateFile');
    }

    public addOptions(command: Command): void {
        super.addOptions(command);
        command.option('--change-set-name [change-set-name]', 'change set name');
        command.option('--output <output>', 'serialization format used when printing change set. Either json or yaml.', 'json');
    }

    public async performCommand(command: ICreateChangeSetCommandArgs): Promise<void> {

        if (!['json', 'yaml'].includes(command.output)) {
            ConsoleUtil.LogError(`Invalid output format '${command.output}'. Must be either 'json' or 'yaml'.`);
            return;
        }

        const template = await TemplateRoot.create(command.templateFile, { TemplatingContext: command.TemplatingContext });
        const state = await this.getState(command);

        GlobalState.Init(state, template);

        const binder = await this.getOrganizationBinder(template, state);

        const stateBucketName = await BaseCliCommand.GetStateBucketName(command.stateBucketName);
        const provider = new ChangeSetProvider(stateBucketName);
        const tasks = binder.enumBuildTasks();

        const changeSet = await provider.createChangeSet(command.changeSetName, template, tasks);

        const isPartition = await AwsUtil.GetPartitionProfile();
        if (isPartition) {
            const partitionProvider = new ChangeSetProvider(stateBucketName, true);
            await partitionProvider.createChangeSet(command.changeSetName, template, tasks);

        }

        if (command.output === 'json') {
            ConsoleUtil.Out(JSON.stringify(changeSet, null, 2));
        } else if (command.output === 'yaml') {
            ConsoleUtil.Out(yamlDump(changeSet));
        }
    }
}

export interface ICreateChangeSetCommandArgs extends ICommandArgs {
    masterAccountId?: any;
    templateFile: string;
    TemplatingContext?: {};
    changeSetName?: string;
    output?: 'json' | 'yaml';
}
