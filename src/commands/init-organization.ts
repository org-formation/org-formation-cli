import { Command } from 'commander';
import { FileUtil } from '../file-util';
import { OrgFormationError } from '../org-formation-error';
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
        if (!command.region) {
            throw new OrgFormationError(`argument --region is missing`);
        }

        const region = command.region;
        const filePath = command.file;
        const storageProvider = await this.createOrGetStateBucket(command, region);
        const template = await this.generateDefaultTemplate();
        const templateContents = template.template;
        FileUtil.writeFileSync(filePath, templateContents);

        await template.state.save(storageProvider);

    }
}

export interface IInitCommandArgs extends ICommandArgs {
    file: string;
    region: string;
}
