import fs from 'fs';
import path from 'path';
import { yamlParse } from 'yaml-cfn';

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
        const buildFile = yamlParse(contents) as Record<string, IBuildTask>;
        const tasks: IBuildTask[] = [];
        for (const name in buildFile) {
            const task = buildFile[name];
            task.name = name;
            task.Template = path.join(this.directory, task.Template);
            tasks.push(task);
        }
        return tasks;
    }
}

export interface IBuildTask {
    Type: 'update-stacks' | 'update-organization';
    Template: string;
    StackName: string;
    DependsOn?: string;
    name?: string;
    done?: boolean;
}
