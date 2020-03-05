import { v4 } from 'uuid';
import { OrgFormationError } from '../org-formation-error';
import { IBuildTask } from '~org-binder/org-tasks-provider';
import { ITemplate, TemplateRoot } from '~parser/parser';
import { S3StorageProvider } from '~state/storage-provider';


export class ChangeSetProvider {

    public static CreateChangeSet(tasks: IBuildTask[], changeSetName: string): IOrganizationChangeSet {
        const includedChangeActions = ['CommitHash'];

        return {
            changeSetName,
            changes: tasks.filter(x => includedChangeActions.indexOf(x.action) === -1)
                          .map(x => ({
                            logicalId: x.logicalId,
                            type: x.type,
                            action: x.action,
                           })),
        };
    }
    private stateBucketName: string;
    constructor(stateBucketName: string) {
        this.stateBucketName = stateBucketName;
    }

    public async createChangeSet(changeSetName: string, template: TemplateRoot, tasks: IBuildTask[]): Promise<IOrganizationChangeSet> {

        const name = changeSetName || v4();
        const changeSet = ChangeSetProvider.CreateChangeSet(tasks, name);

        const completeDocument = {
            changeSet,
            template: template.contents,
        } as IStoredChangeSet;

        const storageProvider = await this.createStorageProvider(name);
        await storageProvider.putObject(completeDocument);

        return changeSet;
    }

    public async getChangeSet(changeSetName: string): Promise<IStoredChangeSet> {
        if (!changeSetName) { throw new OrgFormationError('changeSetName missing'); }
        const storageProvider = await this.createStorageProvider(changeSetName);
        const storedChangeSet = await storageProvider.getObject<IStoredChangeSet>();
        return storedChangeSet;
    }

    private async createStorageProvider(changeSetName: string): Promise<S3StorageProvider> {
        const storageKey = `change-sets/${changeSetName}`;
        return await S3StorageProvider.Create(this.stateBucketName, storageKey);
    }
}

export interface IStoredChangeSet {
    changeSet: IOrganizationChangeSet;
    template: ITemplate;
}

export interface IOrganizationChangeSet {
    changeSetName: string;
    changes: IOrganizationChange[];
}

export interface IOrganizationChange {
    logicalId: string;
    action: string;
    type: string;
}
