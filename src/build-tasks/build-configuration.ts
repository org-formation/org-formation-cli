import fs, { readFileSync } from 'fs';
import path from 'path';
import md5 from 'md5';
import { yamlParse } from 'yaml-cfn';
import { ICommandArgs } from '../commands/base-command';
import { IUpdateStacksCommandArgs } from '../commands/update-stacks';
import { OrgFormationError } from '../org-formation-error';
import { IOrganizationBinding } from '../parser/parser';
import { BaseStacksTask, BuildTaskProvider } from './build-task-provider';

export class BuildConfiguration {
    public tasks: IBuildTaskConfiguration[];
    private file: string;

    constructor(input: string) {
        this.file = input;
        this.tasks = this.enumBuildConfiguration(this.file);
    }

    public enumValidationTasks(command: ICommandArgs): IBuildTask[] {
        this.fixateOrganizationFile(command);
        const result: IBuildTask[] = [];
        for (const taskConfig of this.tasks) {
            const task = BuildTaskProvider.createValidationTask(taskConfig, command);
            result.push(task);
        }

        this.validateTasksFile(result);

        return result;
    }

    public enumBuildTasks(command: ICommandArgs): IBuildTask[] {
        this.fixateOrganizationFile(command);
        const result: IBuildTask[] = [];
        for (const taskConfig of this.tasks) {
            const task = BuildTaskProvider.createBuildTask(taskConfig, command);
            result.push(task);
        }

        this.validateTasksFile(result);

        return result;
    }
    private validateTasksFile(tasks: IBuildTask[]) {
        const updateStackTasks = tasks.filter(x => x.type === 'update-stacks') as BaseStacksTask[];
        const stackNames = updateStackTasks.map(x => x.stackName);
        this.throwForDuplicateVale(stackNames, x => new OrgFormationError(`found more than 1 update-stacks with stackName ${x}.`));
    }

    private fixateOrganizationFile(command: ICommandArgs) {
        const updateStacksCommand = command as IUpdateStacksCommandArgs;

        if (updateStacksCommand.organizationFile === undefined) {
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
            updateStacksCommand.organizationFile = path.resolve(dir, updateOrgTask.Template);
            const organizationTemplateContent = readFileSync(updateStacksCommand.organizationFile);

            updateStacksCommand.organizationFileHash = md5(organizationTemplateContent);
        }
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

    private throwForDuplicateVale(arr: string[], fnError: (val: string) => Error) {
        const sortedArr = arr.sort();
        for (let i = 0; i < sortedArr.length - 1; i++) {
            if (sortedArr[i + 1] === sortedArr[i]) {
                const duplicate = sortedArr[i];
                throw fnError(duplicate);
            }
        }
    }
}

export type BuildTaskType = 'update-stacks' | 'update-organization' | 'include' | 'include-dir';

export interface IBuildTaskConfiguration {
    Type: BuildTaskType;
    DependsOn?: string | string[];
    LogicalName: string;
    FilePath?: string;
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
    OrganizationBinding?: IOrganizationBinding; // old: dont use
    OrganizationBindingRegion?: string | string[]; // old: dont use
    DefaultOrganizationBinding?: IOrganizationBinding;
    DefaultOrganizationBindingRegion?: string | string[];
    OrganizationBindings?: Record<string, IOrganizationBinding>;
    TerminationProtection?: boolean;
    MaxConcurrentStacks: number;
    FailedStackTolerance: number;

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
