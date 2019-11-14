import fs from 'fs';
import path from 'path';
import { yamlParse } from 'yaml-cfn';
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

    public enumBuildTasks(): IBuildTask[] {
        if (this.file) {
            return this.enumBuildTasksFromFile(this.file);
        }
    }

    private enumBuildTasksFromFile(filePath: string): IBuildTask[] {
        const buffer = fs.readFileSync(filePath);
        const contents = buffer.toString('utf-8');
        const buildFile = yamlParse(contents) as Record<string, IConfiguredBuildTask>;
        const tasks: IBuildTask[] = [];
        for (const name in buildFile) {
            const config = buildFile[name];
            const task = BuildTaskProvider.createBuildTask(filePath, name, config);
            tasks.push(task);
        }
        return tasks;
    }
}

export type BuidTaskType  = 'update-stacks' | 'update-organization' | 'include'  | 'include-dir';

export interface IConfiguredBuildTask {
    Type: BuidTaskType;
    Template?: string;
    StackName?: string;
    DependsOn?: string;
    Path?: string;
    SearchPattern?: string;
}

export interface IBuildTask {
    name: string;
    type: string;
    dependsOn: string;
    done: boolean;
    perform(command: any): void;
}
