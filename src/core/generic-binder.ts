import { OrgFormationError } from '../../src/org-formation-error';
import { ConsoleUtil } from '../../src/console-util';
import { IGenericTarget, PersistedState } from '~state/persisted-state';
import { TemplateRoot, IOrganizationBinding } from '~parser/parser';

export abstract class GenericBinder<ITaskDefinition extends IGenericTaskDefinition> {
    private readonly template: TemplateRoot;
    private readonly task: ITaskDefinition;
    protected readonly state: PersistedState;
    private readonly organizationBinding: IOrganizationBinding;

    constructor(task: ITaskDefinition, state: PersistedState, template: TemplateRoot, organizationBinding: IOrganizationBinding) {
        this.task = task;
        this.state = state;
        this.template = template;
        this.organizationBinding = organizationBinding;
    }

    public enumBindings(): IGenericBinding<ITaskDefinition>[] {
        const result: IGenericBinding<ITaskDefinition>[] = [];
        for(const logicalTargetAccountName of this.template.resolveNormalizedLogicalAccountIds(this.organizationBinding)) {

            const accountBinding = this.state.getAccountBinding(logicalTargetAccountName);
            if (!accountBinding) { throw new OrgFormationError(`unable to find account ${logicalTargetAccountName} in state. Is your organization up to date?`); }

            for(const region of this.template.resolveNormalizedRegions(this.organizationBinding)) {
                const binding: IGenericBinding<ITaskDefinition> = {
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

                const existingTargetBinding = this.state.getGenericTarget(this.task.type, this.task.name, accountBinding.physicalId, region);

                if (existingTargetBinding && existingTargetBinding.lastCommittedHash === binding.target.lastCommittedHash) {
                    binding.action = 'None';
                }

                ConsoleUtil.LogDebug(`setting build action for ${this.task.type} / ${this.task.name} for ${binding.target.accountId}/${binding.target.region} to ${binding.action}`);

                result.push(binding);
            }
        }

        const targetsInState = this.state.enumGenericTargets<ITaskDefinition>(this.task.type, this.task.name);
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
                    perform: this.createPerformForDelete(binding),
                });
            }
        }

        return result;
    }

    abstract createPerformForDelete(binding: IGenericBinding<ITaskDefinition>): () => Promise<void>;
    abstract createPerformForUpdateOrCreate(binding: IGenericBinding<ITaskDefinition>): () => Promise<void>;
}


export interface IGenericTask {
    action: GenericAction;
    accountId: string;
    region?: string;
    logicalName: string;
    type: string;
    perform: () => Promise<void>;
    isDependency: () => boolean;
}

export interface IGenericBinding<ITaskDefinition> {
    action: GenericAction;
    target: IGenericTarget<ITaskDefinition>;
    task: ITaskDefinition;
}

export interface IGenericTaskDefinition {
    name: string;
    type: string;
    hash: string;
}

type GenericAction = 'UpdateOrCreate' | 'Delete' | 'None';
