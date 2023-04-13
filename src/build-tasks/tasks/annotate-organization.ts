import { Command } from 'commander';
import { ConsoleUtil } from '../../util/console-util';

import { BaseCliCommand } from '../../commands/base-command';
import { TaskRunner } from '~org-binder/org-task-runner';
import { TemplateRoot } from '~parser/parser';
import { PersistedState } from '~state/persisted-state';
import { IBuildTask } from '~org-binder/org-tasks-provider';
import { GlobalState } from '~util/global-state';
import { S3StorageProvider } from '~state/storage-provider';
import { IPerformTasksCommandArgs } from '~commands/index';


const commandName = 'update <templateFile>';
const commandDescription = 'update organization resources';

export class AnnotateOrganizationCommand extends BaseCliCommand<IAnnotateOrganizationCommandArgs> {

    public static async Perform(command: IAnnotateOrganizationCommandArgs): Promise<void> {
        const x = new AnnotateOrganizationCommand();
        await x.performCommand(command);
    }

    static HasRan: boolean;

    static ResetHasRan(): void {
        this.HasRan = false;
    }

    constructor(command?: Command) {
        super(command, commandName, commandDescription, 'templateFile');
    }

    public async performCommand(command: IAnnotateOrganizationCommandArgs): Promise<void> {

        if (!command.organizationFileContents) {
            throw new Error('annotate-organization command requires to be ran using perform-tasks');
        }
        this.loadTemplatingContext(command);
        const template = TemplateRoot.createFromContents(command.organizationFileContents);
        const state = await this.getState(command);

        GlobalState.Init(state, template);

    }

    public static async ExecuteTasks(tasks: IBuildTask[], state: PersistedState, templateHash: string, template: TemplateRoot, partitionProvider?: S3StorageProvider): Promise<void> {
        try {
            if (tasks.length === 0) {
                ConsoleUtil.LogInfo('organization up to date, no work to be done.');
            } else {
                await TaskRunner.RunTasks(tasks);
                ConsoleUtil.LogInfo('done');
            }
            state.putTemplateHash(templateHash);
            state.setPreviousTemplate(template.source);
        }
        finally {
            await state.save();

            if (partitionProvider !== undefined) {
                await state.save(partitionProvider, true);
            }

        }
    }
}

export interface IAnnotateOrganizationCommandArgs extends IPerformTasksCommandArgs {
    defaultOrganizationAccessRoleName?: string;
    accountMapping?: Map<string, string>;
    organizationalUnitMapping?: Map<string, string>;
    TemplatingContext?: {};
    templatingContextFile?: string;
    debugTemplating?: boolean;
}
