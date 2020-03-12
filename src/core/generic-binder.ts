import { OrgFormationError } from '../../src/org-formation-error';
import { IGenericTarget, PersistedState } from '~state/persisted-state';
import { TemplateRoot, IOrganizationBinding } from '~parser/parser';

export abstract class GenericBinder<ITaskDefinition extends IGenericTaskDefinition> {
    private readonly template: TemplateRoot;
    private readonly task: ITaskDefinition;
    private readonly state: PersistedState;
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

            const binding: IGenericBinding<ITaskDefinition> = {
                action: 'UpdateOrCreate',
                target: {
                    targetType: this.task.type,
                    logicalAccountId: logicalTargetAccountName,
                    accountId: accountBinding.physicalId,
                    definition: this.task,
                    logicalName: this.task.name,
                    lastCommittedHash: this.task.hash,
                },
                task: this.task,
            };

            const existingTargetBinding = this.state.getGenericTarget(this.task.type, this.task.name, accountBinding.physicalId);

            if (existingTargetBinding && existingTargetBinding.lastCommittedHash === binding.target.lastCommittedHash) {
                binding.action = 'None';
            }

            result.push(binding);
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
