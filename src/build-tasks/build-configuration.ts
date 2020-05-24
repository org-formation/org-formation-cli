import fs, { readFileSync } from 'fs';
import path from 'path';
import md5 from 'md5';
import { OrgFormationError } from '../org-formation-error';
import { BuildTaskProvider } from './build-task-provider';
import { IUpdateOrganizationTaskConfiguration } from './tasks/organization-task';
import { IUpdateStacksBuildTask } from './tasks/update-stacks-task';
import { IPerformTasksCommandArgs } from '~commands/index';
import { yamlParse } from '~yaml-cfn/index';
import { CfnExpressionResolver } from '~core/cfn-expression-resolver';

export class BuildConfiguration {
    public tasks: IBuildTaskConfiguration[];
    public parameters: Record<string, IBuildFileParameter>;
    private file: string;

    constructor(input: string, private readonly parameterValues: Record<string, string> = {}) {
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
        const buildFile = this.loadBuildFile(filePath);
        if (buildFile.AWSTemplateFormatVersion !== undefined) {
            throw new OrgFormationError(`Error loading tasks file ${filePath}, seems like you are loading a template where a tasks file was expected...`);
        }
        return this.enumBuildConfigurationFromBuildFile(filePath, buildFile);
    }

    public loadBuildFile(filePath: string): IBuildFile {
        const buffer = fs.readFileSync(filePath);
        const contents = buffer.toString('utf-8');

        const buildFile = yamlParse(contents) as IBuildFile;
        if (buildFile === undefined) {
            return {};
        }
        return buildFile;
    }
    public enumBuildConfigurationFromBuildFile(filePath: string, buildFile: IBuildFile): IBuildTaskConfiguration[] {
        this.parameters = buildFile.Parameters;
        delete buildFile.Parameters;

        const expressionResolver = new CfnExpressionResolver();
        for(const paramName in this.parameters) {
            const param = this.parameters[paramName];
            const paramType = param.Type;

            if (paramType === undefined) {
                throw new OrgFormationError(`expected Type on parameter ${paramName} declared in tasks file ${filePath}`);
            }

            const supportedParamTypes = ['String', 'Number', 'Boolean'];
            if (!supportedParamTypes.includes(paramType)) {
                throw new OrgFormationError(`unsupported Type on parameter ${paramName} expected one of ${supportedParamTypes.join(', ')}, found: ${paramType}`);
            }

            let value: any = this.parameterValues[paramName];
            if (value === undefined) {
                value = param.Default;
            }

            if (value === undefined) {
                throw new OrgFormationError(`expected value for parameter ${paramName} declared in tasks file ${filePath}`);
            }

            if (paramType === 'Boolean') {
                if (value === 'true' || value === 1 || value === true){
                    value = true;
                } else if (value === 'false' || value === 0 || value === false) {
                    value = false;
                } else {
                    throw new OrgFormationError(`unable to convert value for parameter ${paramName} to boolean. Expected: 'true', 'false', 0 or 1. received ${value}`);
                }
            }

            if (paramType === 'Number') {
                value = parseInt(value, 10);
            }

            expressionResolver.addParameter(paramName, value);
        }
        const resolvedContents = expressionResolver.resolveParameters(buildFile);

        const result: IBuildTaskConfiguration[] = [];
        for (const name in resolvedContents) {
            const config = resolvedContents[name] as IBuildTaskConfiguration;
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
    Skip?: boolean;
    TaskRoleName?: string;
    ForceDeploy?: boolean;
    LogVerbose?: boolean;
}


export interface IBuildTask {
    name: string;
    type: string;
    skip: boolean;
    isDependency(task: IBuildTask): boolean;
    childTasks: IBuildTask[];
    perform(): Promise<void>;
    physicalIdForCleanup?: string;
}

export interface IBuildFile extends Record<string, IBuildTaskConfiguration | {}>{
    Parameters?: Record<string, IBuildFileParameter>;
}

export interface IBuildFileParameter {
    Type: string;
    Default: string;
}
