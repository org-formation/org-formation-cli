import { OrgFormationError } from '../../src/org-formation-error';
import { CdkBuildTaskPlugin } from './impl/cdk-build-task-plugin';
import { SlsBuildTaskPlugin } from './impl/sls-build-task-plugin';
import { CopyToS3TaskPlugin } from './impl/s3-copy-build-task-plugin';
import { IBuildTaskConfiguration } from '~build-tasks/build-configuration';
import { ICommandArgs } from '~commands/base-command';
import { IPluginBinding, IPluginTask } from '~plugin/plugin-binder';
import { IPerformTasksCommandArgs } from '~commands/index';
import { IOrganizationBinding, TemplateRoot } from '~parser/parser';
import { PersistedState } from '~state/persisted-state';

export interface IBuildTaskPlugin<TBuildTaskConfig extends IBuildTaskConfiguration, TCommandArgs extends IBuildTaskPluginCommandArgs, TTask extends IPluginTask> {
    type: string;
    typeForTask: string;
    applyGlobally: boolean;
    convertToCommandArgs(config: TBuildTaskConfig, command: IPerformTasksCommandArgs): TCommandArgs;
    validateCommandArgs(command: TCommandArgs): void;

    getValuesForEquality(command: TCommandArgs): any;
    convertToTask(command: TCommandArgs, hashOfTask: string): TTask;

    performRemove(binding: IPluginBinding<TTask>, template: TemplateRoot, state: PersistedState): Promise<void>;
    performCreateOrUpdate(binding: IPluginBinding<TTask>, template: TemplateRoot, state: PersistedState): Promise<void>;
}

export interface IBuildTaskPluginCommandArgs extends ICommandArgs {
    name: string;
    organizationFile?: string;
    organizationFileHash?: string;
    organizationBinding: IOrganizationBinding;
    maxConcurrent: number;
    failedTolerance: number;
    taskRoleName?: string;
}

export class PluginProvider {
    static GetPlugin(type: string): IBuildTaskPlugin<any, any, any> {
        const found = this.GetPlugins().find(x=>x.type === type);
        if (found === undefined) {
            throw new OrgFormationError(`unable to find plugin of type ${type}`);
        }
        return found;
    }

    static GetPlugins(): IBuildTaskPlugin<any, any, any>[] {
        return [
            new CdkBuildTaskPlugin(),
            new SlsBuildTaskPlugin(),
            new CopyToS3TaskPlugin(),
        ];
    }
}
