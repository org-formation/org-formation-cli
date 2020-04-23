import { OrgFormationError } from '../org-formation-error';
import { ConsoleUtil } from '../util/console-util';
import { IGenericTarget, PersistedState } from '~state/persisted-state';
import { TemplateRoot, IOrganizationBinding } from '~parser/parser';
import { IBuildTaskPlugin } from '~plugin/plugin';
import { ICfnExpression } from '~core/cfn-expression';
import { CfnExpressionResolver } from '~core/cfn-expression-resolver';

export class PluginBinder<TTaskDefinition extends IPluginTask> {

    constructor(private readonly task: TTaskDefinition,
                protected readonly state: PersistedState,
                private readonly template: TemplateRoot,
                private readonly organizationBinding: IOrganizationBinding,
                private readonly plugin: IBuildTaskPlugin<any, any, TTaskDefinition>) {

    }

    public enumBindings(): IPluginBinding<TTaskDefinition>[] {
        const result: IPluginBinding<TTaskDefinition>[] = [];
        for(const logicalTargetAccountName of this.template.resolveNormalizedLogicalAccountIds(this.organizationBinding)) {

            const accountBinding = this.state.getAccountBinding(logicalTargetAccountName);
            if (!accountBinding) { throw new OrgFormationError(`unable to find account ${logicalTargetAccountName} in state. Is your organization up to date?`); }

            let regions = this.template.resolveNormalizedRegions(this.organizationBinding);

            for(const region of regions) {
                const binding: IPluginBinding<TTaskDefinition> = {
                    action: 'UpdateOrCreate',
                    target: {
                        targetType: this.task.type,
                        logicalAccountId: logicalTargetAccountName,
                        region,
                        accountId: accountBinding.physicalId,
                        definition: this.task,
                        logicalName: this.task.name,
                        lastCommittedHash: this.task.hash,
                    },
                    task: this.task,
                };

                const existingTargetBinding = this.state.getGenericTarget<TTaskDefinition>(this.task.type, this.task.name, accountBinding.physicalId, region);

                if (existingTargetBinding && existingTargetBinding.lastCommittedHash === binding.target.lastCommittedHash) {
                    binding.action = 'None';
                }

                ConsoleUtil.LogDebug(`setting build action for ${this.task.type} / ${this.task.name} for ${binding.target.accountId}/${binding.target.region} to ${binding.action}`);

                result.push(binding);
            }
        }

        const targetsInState = this.state.enumGenericTargets<TTaskDefinition>(this.task.type, this.task.name);
        for(const targetToBeDeleted of targetsInState.filter(x=>!result.find(y=>y.target.accountId === x.accountId && y.target.region === x.region))) {
            result.push({
                action: 'Delete',
                task: this.task,
                target: {
                    targetType: this.task.type,
                    logicalAccountId: targetToBeDeleted.logicalAccountId,
                    region: targetToBeDeleted.region,
                    accountId: targetToBeDeleted.accountId,
                    definition: this.task,
                    logicalName: this.task.name,
                    lastCommittedHash: this.task.hash,
                },
            });

            ConsoleUtil.LogDebug(`setting build action for ${this.task.type} / ${this.task.name} for ${targetToBeDeleted.accountId} to Delete`);

        }
        return result;
    }

    public enumTasks(): IGenericTask[] {
        const result: IGenericTask[] = [];

        for (const binding of this.enumBindings()) {

            const task = {
                logicalName: binding.task.name,
                type: binding.task.type,
                action: binding.action,
                accountId: binding.target.accountId,
                region: binding.target.region,
                isDependency: (): boolean => false,
            };

            if (binding.action === 'UpdateOrCreate') {
                result.push({
                    ...task,
                    perform: this.createPerformForUpdateOrCreate(binding),
                });
            } else if (binding.action === 'Delete') {
                result.push({
                    ...task,
                    perform: this.createPerformForRemove(binding),
                });
            }
        }

        return result;
    }

    public createPerformForRemove(binding: IPluginBinding<TTaskDefinition>): () => Promise<void> {
        const { task, target } = binding;
        const that = this;

        return async (): Promise<void> => {

            const expressionResolver = CfnExpressionResolver.CreateDefaultResolver(target.logicalAccountId, target.accountId, target.region, task.taskRoleName, this.template, this.state);
            await this.plugin.appendResolvers(expressionResolver, binding);
            binding.task = await expressionResolver.resolve(binding.task);
            binding.task = await expressionResolver.collapse(binding.task);

            await that.plugin.performRemove(binding, expressionResolver);
            that.state.removeGenericTarget(task.type, task.name, target.accountId, target.region);
        };
    }
    public createPerformForUpdateOrCreate(binding: IPluginBinding<TTaskDefinition>): () => Promise<void> {
        const { task, target } = binding;
        const that = this;

        return async (): Promise<void> => {

            const expressionResolver = CfnExpressionResolver.CreateDefaultResolver(target.logicalAccountId, target.accountId, target.region, task.taskRoleName, this.template, this.state);
            await this.plugin.appendResolvers(expressionResolver, binding);
            binding.task = await expressionResolver.resolve(binding.task);
            binding.task = await expressionResolver.collapse(binding.task);

            await that.plugin.performCreateOrUpdate(binding, expressionResolver);
            that.state.setGenericTarget<TTaskDefinition>(target);
        };
    }
}


export interface IGenericTask {
    action: GenericAction;
    accountId: string;
    region: string;
    logicalName: string;
    type: string;
    perform: () => Promise<void>;
    isDependency: () => boolean;
}

export interface IPluginBinding<ITaskDefinition> {
    action: GenericAction;
    target: IGenericTarget<ITaskDefinition>;
    task: ITaskDefinition;
}

export interface IPluginTask {
    name: string;
    type: string;
    hash: string;
    taskRoleName?: string;
    parameters?: Record<string, ICfnExpression>;
}

type GenericAction = 'UpdateOrCreate' | 'Delete' | 'None';
