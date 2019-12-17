import { throws } from 'assert';
import { Command } from 'commander';
import { writeFileSync } from 'fs';
import { IStorageProvider } from '../state/storage-provider';
import { BaseCliCommand, ICommandArgs } from './base-command';

const commandName = 'init <file>';
const commandDescription = 'generate template & initialize organization';

export class InitOrganizationCommand extends BaseCliCommand<IInitCommandArgs> {

    constructor(command: Command) {
        super(command, commandName, commandDescription, 'file');
    }

    public addOptions(command: Command) {
        command.option('--region <region>', 'region used to created state-bucket in');
        super.addOptions(command);
    }

    public async performCommand(command: IInitCommandArgs) {
        const region = command.region;
        const filePath = command.file;
        let storageProvider: IStorageProvider;
        try {
            storageProvider = await this.createStateBucket(command, region);
        } catch (err) {
            if (err.code === 'BucketAlreadyOwnedByYou') {
                storageProvider = await this.getStateBucket(command);
            }
        }

        const template = await this.generateDefaultTemplate();
        const templateContents = template.template;
        writeFileSync(filePath, templateContents);

        await template.state.save(storageProvider);

    }
}

interface IInitCommandArgs extends ICommandArgs {
    file: string;
    region: string;
}
