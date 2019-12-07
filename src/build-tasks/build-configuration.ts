import fs from 'fs';
import path from 'path';
import { yamlParse } from 'yaml-cfn';
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

    public enumBuildTasks(command: any): IBuildTask[] {
        return this.enumBuildTasksFromFile(this.file, command);
    }

    private enumBuildTasksFromFile(filePath: string, command: any): IBuildTask[] {
        const buffer = fs.readFileSync(filePath);
        const contents = buffer.toString('utf-8');
        const buildFile = yamlParse(contents) as Record<string, IConfiguredBuildTask>;
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

export interface IConfiguredBuildTask {
    Type: BuildTaskType;
    Template?: string;
    DependsOn?: string | string[];
    Path?: string;
    SearchPattern?: string;
}

export interface IConfiguratedUpdateStackBuildTask extends IConfiguredBuildTask {
    StackName?: string;
    StackDescription?: string;
    Parameters?: Record<string, string>;
    DeletionProtection?: boolean;
    OrganizationBinding?: IOrganizationBinding;
    OrganizationBindingRegion?: string | string[];
    TerminationProtection?: boolean;
}

export interface IBuildTask {
    name: string;
    type: BuildTaskType;
    isDependency(task: IBuildTask): boolean;
    perform(): Promise<void>;
}
