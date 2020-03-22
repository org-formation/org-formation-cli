import fs, { readFileSync } from 'fs';
import path from 'path';
import md5 from 'md5';
import { yamlParse } from 'yaml-cfn';
import { OrgFormationError } from '../org-formation-error';
import { BuildTaskProvider } from './build-task-provider';
import { IUpdateOrganizationTaskConfiguration } from './tasks/organization-task';
import { IUpdateStacksBuildTask } from './tasks/update-stacks-task';
import { IPerformTasksCommandArgs } from '~commands/index';

export class BuildConfiguration {
    public tasks: IBuildTaskConfiguration[];
    private file: string;

    constructor(input: string) {
        this.file = input;
        this.tasks = this.enumBuildConfiguration(this.file);
    }

    public enumValidationTasks(command: IPerformTasksCommandArgs): IBuildTask[] {
        this.fixateOrganizationFile(command);
        const result: IBuildTask[] = [];
        for (const taskConfig of this.tasks) {
            const task = BuildTaskProvider.createValidationTask(taskConfig, command);
            if (task !== undefined) {
                result.push(task);
            }
        }

        this.validateTasksFile(result);

        return result;
    }

    public enumBuildTasks(command: IPerformTasksCommandArgs): IBuildTask[] {
        this.fixateOrganizationFile(command);
        const result: IBuildTask[] = [];
        for (const taskConfig of this.tasks) {
            const task = BuildTaskProvider.createBuildTask(taskConfig, command);
            result.push(task);
        }

        this.validateTasksFile(result);

        return result;
    }

    private validateTasksFile(tasks: IBuildTask[]): void {
        const updateStackTasks = BuildTaskProvider.recursivelyFilter(tasks, x => x.type === 'update-stacks') as IUpdateStacksBuildTask[];
        const stackNames = updateStackTasks.map(x => x.StackName);
        this.throwForDuplicateVal(stackNames, x => new OrgFormationError(`found more than 1 update-stacks with stackName ${x}.`));

        const updateOrgTasks = BuildTaskProvider.recursivelyFilter(tasks, x => x.type === 'update-organization');
        if (updateOrgTasks.length > 1) {
            throw new OrgFormationError('multiple update-organization tasks found');
        }
    }

    private fixateOrganizationFile(command: IPerformTasksCommandArgs): void{

        if (command.organizationFile === undefined) {
            const updateOrgTasks = this.tasks.filter(x => x.Type === 'update-organization');
            if (updateOrgTasks.length === 0) {
                throw new OrgFormationError('tasks file does not contain a task with type update-organization');
            }
            if (updateOrgTasks.length > 1) {
                throw new OrgFormationError('tasks file has multiple tasks with type update-organization');
            }
            const updateOrgTask = updateOrgTasks[0] as IUpdateOrganizationTaskConfiguration;
            if (updateOrgTask.Template === undefined) {
                throw new OrgFormationError('update-organization task does not contain required Template attribute');
            }
            const dir = path.dirname(this.file);
            command.organizationFile = path.resolve(dir, updateOrgTask.Template);
        }

        if (command.organizationFileHash === undefined) {
            const organizationTemplateContent = readFileSync(command.organizationFile);
            command.organizationFileHash = md5(organizationTemplateContent);
        }
    }

    public enumBuildConfiguration(filePath: string): IBuildTaskConfiguration[] {
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

    private throwForDuplicateVal(arr: string[], fnError: (val: string) => Error): void {
        const sortedArr = arr.sort();
        for (let i = 0; i < sortedArr.length - 1; i++) {
            if (sortedArr[i + 1] === sortedArr[i]) {
                const duplicate = sortedArr[i];
                throw fnError(duplicate);
            }
        }
    }
}


export interface IBuildTaskConfiguration {
    Type: string;
    DependsOn?: string | string[];
    LogicalName: string;
    FilePath?: string;
}


export interface IBuildTask {
    name: string;
    type: string;
    isDependency(task: IBuildTask): boolean;
    childTasks: IBuildTask[];
    perform(): Promise<void>;
    physicalIdForCleanup?: string;
}
