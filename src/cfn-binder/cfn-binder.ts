import { OrgFormationError } from '../org-formation-error';
import { OrgResourceTypes } from '../parser/model/resource-types';
import { IResourceTarget } from '../parser/model/resources-section';
import { TemplateRoot } from '../parser/parser';
import { ICfnTarget, PersistedState } from '../state/persisted-state';
import { CfnTaskProvider, ICfnTask } from './cfn-task-provider';
import { CfnTransform } from './cfn-transform';
import md5 = require('md5');

export class CloudFormationBinder {
    private template: TemplateRoot;
    private stackName: string;
    private state: PersistedState;
    private taskProvider: CfnTaskProvider;
    private templateTransform: CfnTransform;
    private masterAccount: string;

    constructor(stackName: string, template: TemplateRoot, state: PersistedState, taskProvider: CfnTaskProvider = new CfnTaskProvider(state), templateTransform: CfnTransform = new CfnTransform(template, state)) {
        this.template = template;
        this.masterAccount = template.organizationSection.masterAccount.accountId;
        this.state = state;
        this.taskProvider = taskProvider;
        this.templateTransform = templateTransform;
        this.stackName = stackName;
        if (this.state.masterAccount && this.masterAccount && this.state.masterAccount !== this.masterAccount) {
            throw new OrgFormationError('state and template do not belong to the same organization');
        }
    }

    public enumBindings(): ICfnBinding[] {
        const result: ICfnBinding[] = [];
        const targetsInTemplate = [];
        const targets = this.template.resourcesSection.enumTemplateTargets(this.templateTransform);

        for (const resourceTarget of targets) {
            const templateForTarget = this.templateTransform.createTemplateForBinding(resourceTarget);
            resourceTarget.hash = md5(templateForTarget);
            resourceTarget.template = templateForTarget;
        }

        for (const target of targets) {
            let accountId = '';
            if (this.template.organizationSection.masterAccount && this.template.organizationSection.masterAccount.logicalId === target.accountLogicalId) {
                accountId = this.state.masterAccount;
            } else  {
                accountId = this.state.getBinding(OrgResourceTypes.Account, target.accountLogicalId).physicalId;
            }
            const region = target.region;
            const stackName = this.stackName;
            const key = {accountId, region, stackName};
            targetsInTemplate.push(key);
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
        for (const storedTargets of this.state.enumTargets(this.stackName)) {
            const accountId = storedTargets.accountId;
            const region = storedTargets.region;
            const stackName = storedTargets.stackName;
            if (!targetsInTemplate.find((element) => element.accountId === accountId && element.region === region && element.stackName === stackName)) {
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

    public enumTasks() {
        const result: ICfnTask[] = [];
        for (const binding of this.enumBindings()) {
            if (binding.action === 'UpdateOrCreate') {
                const task = this.taskProvider.createUpdateTemplateTask(binding, binding.template.template, binding.template.hash);
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
