import fs from 'fs';
import path from 'path';
import { yamlParse } from 'yaml-cfn';
import { ICommandArgs } from '../commands/base-command';
import { IOrganizationBinding } from '../parser/parser';
import { BuildTaskProvider } from './build-task-provider';

export class BuildConfiguration {
    private directory: string;
    private file: string;

    constructor(input: string) {
        if (fs.statSync(input).isDirectory()) {
            this.directory = input;
        } else {
            this.file = input;
            this.directory = path.dirname(input);
        }
    }

    public enumBuildTasks(command: ICommandArgs): IBuildTask[] {
        return this.enumBuildTasksFromFile(this.file, command);
    }

    private enumBuildTasksFromFile(filePath: string, command: ICommandArgs): IBuildTask[] {
        const buffer = fs.readFileSync(filePath);
        const contents = buffer.toString('utf-8');
        const buildFile = yamlParse(contents) as Record<string, IBuildTaskConfiguration>;
        const tasks: IBuildTask[] = [];
        for (const name in buildFile) {
            const config = buildFile[name];
            const task = BuildTaskProvider.createBuildTask(filePath, name, config, command);
            tasks.push(task);
        }
        return tasks;
    }
}

export type BuildTaskType = 'update-stacks' | 'update-organization' | 'include' | 'include-dir';

export interface IBuildTaskConfiguration {
    Type: BuildTaskType;
    DependsOn?: string | string[];
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
