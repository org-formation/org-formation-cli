import { OrgFormationError } from '../org-formation-error';
import { IBuildTask, IBuildTaskConfiguration } from './build-configuration';
import { UpdateOrganizationTaskProvider } from './tasks/organization-task';
import { UpdateStacksBuildTaskProvider } from './tasks/update-stacks-task';
import { IncludeTaskProvider } from './tasks/include-task';
import { IPerformTasksCommandArgs }  from '~commands/index';
import { ITrackedTask } from '~state/persisted-state';
import { PluginProvider } from '~plugin/plugin';
import { PluginBuildTaskProvider } from '~plugin/plugin-task';
import { CfnExpressionResolver } from '~core/cfn-expression-resolver';

export class BuildTaskProvider {
    private static SingleInstance: BuildTaskProvider;
    private providers: Record<string, IBuildTaskProvider<any>> = {};

    constructor(providers: IBuildTaskProvider<any>[]) {
        for(const provider of providers) {
            this.providers[provider.type] = provider;
        }
    }

    private static GetBuildTaskProvider(): BuildTaskProvider {
        if (BuildTaskProvider.SingleInstance) {return BuildTaskProvider.SingleInstance;}

        const buildTaskProviders: IBuildTaskProvider<any>[] = [
            new UpdateStacksBuildTaskProvider(),
            new UpdateOrganizationTaskProvider(),
            new IncludeTaskProvider(),
        ];

        for(const plugin of  PluginProvider.GetPlugins()){
            buildTaskProviders.push(new PluginBuildTaskProvider<any, any, any>(plugin));
        }

        return BuildTaskProvider.SingleInstance = new BuildTaskProvider(buildTaskProviders);
    }


    public static createValidationTask(configuration: IBuildTaskConfiguration, command: IPerformTasksCommandArgs, resolver: CfnExpressionResolver): IBuildTask {
        const taskProvider = this.GetBuildTaskProvider();
        const provider = taskProvider.providers[configuration.Type];
        if (provider === undefined) {throw new OrgFormationError(`unable to load file ${configuration.FilePath}, unknown configuration type ${configuration.Type}`);}
        const validationTask = provider.createTaskForValidation(configuration, command, resolver);
        return validationTask;
    }

    static createPrintTask(configuration: IBuildTaskConfiguration, command: IPerformTasksCommandArgs, resolver: CfnExpressionResolver): IBuildTask {
        const taskProvider = this.GetBuildTaskProvider();
        const provider = taskProvider.providers[configuration.Type];
        if (provider === undefined) {throw new OrgFormationError(`unable to load file ${configuration.FilePath}, unknown configuration type ${configuration.Type}`);}
        const validationTask = provider.createTaskForPrint(configuration, command, resolver);
        return validationTask;
    }

    public static createBuildTask(configuration: IBuildTaskConfiguration, command: IPerformTasksCommandArgs, resolver: CfnExpressionResolver): IBuildTask {
        const taskProvider = this.GetBuildTaskProvider();
        const provider = taskProvider.providers[configuration.Type];
        if (provider === undefined) {throw new OrgFormationError(`unable to load file ${configuration.FilePath}, unknown configuration type ${configuration.Type}`);}
        const task = provider.createTask(configuration, command, resolver);
        return task;
    }

    public static createDeleteTask(logicalId: string, type: string, physicalId: string, command: IPerformTasksCommandArgs): IBuildTask | undefined {
        const taskProvider = this.GetBuildTaskProvider();
        const provider = taskProvider.providers[type];
        if (provider === undefined) {throw new OrgFormationError(`unable to load file, unknown configuration type ${type}`);}
        const task = provider.createTaskForCleanup(logicalId, physicalId, command);
        return task;
    }

    public static enumTasksForCleanup(previouslyTracked: ITrackedTask[], tasks: IBuildTask[], command: IPerformTasksCommandArgs): IBuildTask[] {
        const result: IBuildTask[] = [];
        const currentTasks = BuildTaskProvider.recursivelyFilter(tasks, t => t.physicalIdForCleanup !== undefined);
        const physicalIds = currentTasks.map(x=>x.physicalIdForCleanup);
        for(const tracked of previouslyTracked) {
            if (!physicalIds.includes(tracked.physicalIdForCleanup)) {
                const deleteTask = this.createDeleteTask(tracked.logicalName, tracked.type, tracked.physicalIdForCleanup, command);
                if (deleteTask !== undefined) {
                    result.push(deleteTask);
                }
            }
        }
        return result;
    }

    public static recursivelyFilter(tasks: IBuildTask[], filter: (task: IBuildTask) => boolean): IBuildTask[] {
        const result = tasks.filter(filter);
        const tasksWithChildren = tasks.filter(x => x.childTasks && x.childTasks.length > 0);
        const childrenFlattened = tasksWithChildren.reduce((acc: IBuildTask[], x: IBuildTask)=> acc.concat(...x.childTasks), []);
        if (childrenFlattened.length > 0) {
            const resultFromChildren = BuildTaskProvider.recursivelyFilter(childrenFlattened, filter);
            return result.concat(resultFromChildren);
        }
        return result;
    }

    public static  createIsDependency(buildTaskConfig: IBuildTaskConfiguration): (task: IBuildTask) => boolean {
        return (task: IBuildTask): boolean => {
            if (task.type === 'update-organization') {
                return true;
            }

            if (typeof buildTaskConfig.DependsOn === 'string') {
                return task.name === buildTaskConfig.DependsOn;
            } else if (Array.isArray(buildTaskConfig.DependsOn)) {
                return buildTaskConfig.DependsOn.includes(task.name);
            }
        };
    }
}

export interface IBuildTaskProvider<TConfig extends IBuildTaskConfiguration> {
    type: string;
    createTask(config: TConfig, command: IPerformTasksCommandArgs, resolver?: CfnExpressionResolver): IBuildTask;
    createTaskForValidation(config: TConfig, command: IPerformTasksCommandArgs, resolver?: CfnExpressionResolver): IBuildTask | undefined;
    createTaskForPrint(config: TConfig, command: IPerformTasksCommandArgs, resolver?: CfnExpressionResolver): IBuildTask | undefined;
    createTaskForCleanup(logicalId: string, physicalId: string, command: IPerformTasksCommandArgs, resolver?: CfnExpressionResolver): IBuildTask | undefined;
}
