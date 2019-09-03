import { OrgFormationError } from '../org-formation-error';
import { OrgResourceTypes } from '../parser/model/resource-types';
import { IResourceTarget } from '../parser/model/resources-section';
import { TemplateRoot } from '../parser/parser';
import { ICfnTarget, PersistedState } from '../state/persisted-state';
import { CfnTaskProvider, ICfnTask } from './cfn-task-provider';
import { CfnTransform } from './cfn-transform';

export class CloudFormationBinder {
    private template: TemplateRoot;
    private state: PersistedState;
    private taskProvider: CfnTaskProvider;
    private templateTransform: CfnTransform;
    private masterAccount: string;

    constructor(template: TemplateRoot, state: PersistedState, taskProvider: CfnTaskProvider = new CfnTaskProvider(state), templateTransform: CfnTransform = new CfnTransform(template, state)) {
        this.template = template;
        this.masterAccount = template.organizationSection.masterAccount.accountId;
        this.state = state;
        this.taskProvider = taskProvider;
        this.templateTransform = templateTransform;
        if (this.state.masterAccount && this.masterAccount && this.state.masterAccount !== this.masterAccount) {
            throw new OrgFormationError('state and template do not belong to the same organization');
        }
    }

    public enumBindings(): ICfnBinding[] {
        const result: ICfnBinding[] = [];
        const targetsInTemplate = new Set<{accountId: string, region: string, stackName: string}>();
        const targets = this.template.resourcesSection.enumTemplateTargets();
        for (const target of targets) {
            const accountId = this.state.getBinding(OrgResourceTypes.Account, target.accountLogicalId).physicalId;
            const region = target.region;
            const stackName = this.template.stackName;
            const key = {accountId, region, stackName};
            targetsInTemplate.add(key);
            const cfnTarget = this.state.getTarget(stackName, accountId, region);
            if (cfnTarget === undefined) {
                result.push({
                    ...key,
                    action: 'UpdateOrCreate',
                    template: target,
                    templateHash: target.hash,
                });
            } else {
                const storedHash = cfnTarget.lastCommittedHash;
                if (target.hash !== storedHash) {
                    result.push({
                        ...key,
                        action: 'UpdateOrCreate',
                        template: target,
                        state: cfnTarget,
                        templateHash: target.hash,
                    });
                }
            }
        }
        for (const storedTargets of this.state.enumTargets()) {
            const accountId = storedTargets.accountId;
            const region = storedTargets.region;
            const stackName = storedTargets.stackName;
            if (!targetsInTemplate.has({accountId, region, stackName})) {
                result.push({
                    accountId,
                    region,
                    stackName,
                    action: 'Delete',
                    state: storedTargets,
                });
             }
        }
        return result;
    }

    public enumTasks(): ICfnTask[] {
        const result: ICfnTask[] = [];
        for (const binding of this.enumBindings()) {
            if (binding.action === 'UpdateOrCreate') {
                const template = this.templateTransform.createTemplateForBinding(binding.template);
                const task = this.taskProvider.createUpdateTemplateTask(binding, template, binding.template.hash);
                result.push(...task);
            } else if (binding.action === 'Delete') {
                const task = this.taskProvider.createDeleteTemplateTask(binding);
                result.push(...task);
            }
        }
        return result;
    }
}

export interface ICfnBinding {
    accountId: string;
    region: string;
    stackName: string;
    action: CfnBindingAction;
    template?: IResourceTarget;
    state?: ICfnTarget;
    templateHash?: string;

}
type CfnBindingAction = 'UpdateOrCreate' | 'Delete' | 'None';
