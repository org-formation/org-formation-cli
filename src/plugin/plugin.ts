import { IBuildTaskConfiguration } from "~build-tasks/build-configuration";
import { ICommandArgs } from "~commands/base-command";
import { IPluginBinding, IPluginTask } from "~plugin/plugin-binder";
import { IPerformTasksCommandArgs } from "~commands/index";
import { IOrganizationBinding } from "~parser/parser";
import { CdkBuildTaskPlugin } from "./impl/cdk-build-task-plugin";
import { SlsBuildTaskPlugin } from "./impl/sls-build-task-plugin";
import { CopyToS3TaskPlugin } from "./impl/s3-copy-build-task-plugin";

export interface IBuildTaskPlugin<TBuildTaskConfig extends IBuildTaskConfiguration, TCommandArgs extends IBuildTaskPluginCommandArgs, TTask extends IPluginTask> {
    type: string;
    typeForTask: string;
    convertToCommandArgs(config: TBuildTaskConfig, command: IPerformTasksCommandArgs): TCommandArgs;
    validateCommandArgs(command: TCommandArgs): void;

    getValuesForEquality(command: TCommandArgs): any;
    concertToTask(command: TCommandArgs, hashOfTask: string): TTask;

    performDelete(binding: IPluginBinding<TTask>): Promise<void>;
    performCreateOrUpdate(binding: IPluginBinding<TTask>): Promise<void>;
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
    static GetPlugin(type: string) {
        return this.GetPlugins().find(x=>x.type === type);
    }

    static GetPlugins(): Array<IBuildTaskPlugin<any, any, any>> {
        return [
            new CdkBuildTaskPlugin(),
            new SlsBuildTaskPlugin(),
            new CopyToS3TaskPlugin(),
        ]
    }
}