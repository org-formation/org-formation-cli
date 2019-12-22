import fs from 'fs';
import path from 'path';
import { yamlParse } from 'yaml-cfn';
import { ICommandArgs } from '../commands/base-command';
import { IOrganizationBinding } from '../parser/parser';
import { BuildTaskProvider } from './build-task-provider';

export class BuildConfiguration {
    public tasks: IBuildTaskConfiguration[];
    private file: string;

    constructor(input: string) {
        this.file = input;
        this.tasks = this.enumBuildConfiguration(input);
    }

    public enumValidationTasks(command: ICommandArgs): IBuildTask[] {
        const result: IBuildTask[] = [];
        for (const taskConfig of this.tasks) {
            const task = BuildTaskProvider.createValidationTask(taskConfig, command);
            result.push(task);
        }

        return result;
    }

    public enumBuildTasks(command: ICommandArgs): IBuildTask[] {
        const result: IBuildTask[] = [];
        for (const taskConfig of this.tasks) {
            const task = BuildTaskProvider.createBuildTask(taskConfig, command);
            result.push(task);
        }

        return result;
    }

    private enumBuildConfiguration(filePath: string): IBuildTaskConfiguration[] {
        const buffer = fs.readFileSync(filePath);
        const contents = buffer.toString('utf-8');
        const buildFile = yamlParse(contents) as Record<string, IBuildTaskConfiguration>;
        const result: IBuildTaskConfiguration[] = [];
        for (const name in buildFile) {
            const config = buildFile[name];
            result.push({...config, LogicalName: name, FilePath: filePath});
        }
        return result;
    }
}

export type BuildTaskType = 'update-stacks' | 'update-organization' | 'include' | 'include-dir';

export interface IBuildTaskConfiguration {
    Type: BuildTaskType;
    DependsOn?: string | string[];
    LogicalName: string;
    FilePath: string;
}

export interface IIncludeTaskConfiguration extends IBuildTaskConfiguration {
    Path: string;
    MaxConcurrentTasks?: number;
    FailedTaskTolerance?: number;
}
export interface IIncludeDirTaskConfiguration extends IBuildTaskConfiguration {
    SearchPattern?: string;
    MaxConcurrentTasks: number;
    FailedTaskTolerance: number;
}

export interface IUpdateStackTaskConfiguration extends IBuildTaskConfiguration {
    Template: string;
    StackName?: string;
    StackDescription?: string;
    Parameters?: Record<string, string>;
    DeletionProtection?: boolean;
    OrganizationFile?: string;
    OrganizationBinding?: IOrganizationBinding;
    OrganizationBindingRegion?: string | string[];
    TerminationProtection?: boolean;
}
export interface IUpdateOrganizationTaskConfiguration extends IBuildTaskConfiguration {
    Template: string;
}

export interface IBuildTask {
    name: string;
    type: BuildTaskType;
    isDependency(task: IBuildTask): boolean;
    perform(): Promise<void>;
}
