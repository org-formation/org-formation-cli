import md5 = require('md5');
import { OrgFormationError } from '../org-formation-error';
import { OrgResourceTypes } from '../parser/model/resource-types';
import { IResourceTarget } from '../parser/model/resources-section';
import { TemplateRoot } from '../parser/parser';
import { ICfnTarget, PersistedState } from '../state/persisted-state';
import { CfnTaskProvider, ICfnTask } from './cfn-task-provider';
import { CfnTemplate } from './cfn-template';

export class CloudFormationBinder {
    private template: TemplateRoot;
    private stackName: string;
    private state: PersistedState;
    private taskProvider: CfnTaskProvider;
    private masterAccount: string;

    constructor(stackName: string, template: TemplateRoot, state: PersistedState, taskProvider: CfnTaskProvider = new CfnTaskProvider(state)) {
        this.template = template;
        this.masterAccount = template.organizationSection.masterAccount.accountId;
        this.state = state;
        this.taskProvider = taskProvider;
        this.stackName = stackName;
        if (this.state.masterAccount && this.masterAccount && this.state.masterAccount !== this.masterAccount) {
            throw new OrgFormationError('state and template do not belong to the same organization');
        }
    }

    public enumBindings(): ICfnBinding[] {
        const result: ICfnBinding[] = [];
        const targetsInTemplate = [];
        const targets = this.template.resourcesSection.enumTemplateTargets();

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

            const cfnTemplate = new CfnTemplate(target, this.template, this.state);

            result.push({
                ...key,
                action: 'UpdateOrCreate',
                target,
                state: cfnTarget,
                template: cfnTemplate,
                dependencies: [],
                dependents: []});
        }

        for (const binding of result) {
            for (const dependency of binding.template.listDependencies(binding, result)) {
                binding.dependencies.push(dependency);
                binding.template.addParameter(dependency);

                const other = result.find((x) => x.accountId === dependency.outputAccountId && x.region === dependency.outputRegion && x.stackName === dependency.outputStackName);
                other.dependents.push(dependency);
                other.template.addOutput(dependency);
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
                const task = this.taskProvider.createUpdateTemplateTask(binding);
                task.dependentTaskFilter = (other) => binding.dependencies.findIndex((x) => x.outputAccountId === other.accountId && x.outputRegion === other.region && x.outputStackName === other.stackName) > -1;
                result.push(task);
            } else if (binding.action === 'Delete') {
                const task = this.taskProvider.createDeleteTemplateTask(binding);
                result.push(task);
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
    target?: IResourceTarget;
    state?: ICfnTarget;
    template?: CfnTemplate;
    dependencies?: ICfnCrossAccountDependency[];
    dependents?: ICfnCrossAccountDependency[];
}

export interface ICfnCrossAccountDependency {
    outputAccountId: string;
    outputRegion: string;
    outputStackName: string;
    parameterAccountId: string;
    parameterRegion: string;
    parameterStackName: string;
    valueExpression: any;
    parameterName: string;
    outputName: string;
}

type CfnBindingAction = 'UpdateOrCreate' | 'Delete' | 'None';
