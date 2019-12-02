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
        const templateHash = this.template.hash;
        const storedTargets = this.state.enumTargets(this.stackName);
        for (const target of targets) {
            let accountId = '';
            if (this.template.organizationSection.masterAccount && this.template.organizationSection.masterAccount.logicalId === target.accountLogicalId) {
                accountId = this.state.masterAccount;
            } else  {
                const accountBinding = this.state.getBinding(OrgResourceTypes.Account, target.accountLogicalId);
                if (!accountBinding) {
                    throw new Error(`expected to find an account binding for account ${target.accountLogicalId} in state. Is your organization up to date?`);
                }
                accountId = accountBinding.physicalId;
            }
            const region = target.region;
            const stackName = this.stackName;
            const key = {accountId, region, stackName};
            targetsInTemplate.push(key);

            const cfnTarget = this.state.getTarget(stackName, accountId, region);
            const cfnTemplate = new CfnTemplate(target, this.template, this.state);
            const stored = storedTargets.find((x) => x.region === region && x.accountId === accountId);

            const binding: ICfnBinding = {
                ...key,
                action: 'None',
                target,
                templateHash,
                state: cfnTarget,
                template: cfnTemplate,
                dependencies: [],
                dependents: [],
                regionDependencies: [],
                accountDependencies: [],
            };
            const dependsOnAccounts = new Set<string>();
            const dependsOnRegions = new Set<string>();
            for (const resource of target.resources) {
                for (const accountLogiocalId of resource.dependsOnAccount) {
                    dependsOnAccounts.add(accountLogiocalId);
                }
            }
            for (const resource of target.resources) {
                for (const dependsOnRegion of resource.dependsOnRegion) {
                    dependsOnRegions.add(dependsOnRegion);
                }
            }

            binding.regionDependencies = [...dependsOnRegions];

            for (const dependsOnLogicalAccount of dependsOnAccounts) {
                const dependsOnAccountBinding = this.state.getBinding(OrgResourceTypes.Account, dependsOnLogicalAccount) || this.state.getBinding(OrgResourceTypes.MasterAccount, dependsOnLogicalAccount);
                if (!dependsOnAccountBinding) {
                    throw new Error(`unable to find account with logical Id ${dependsOnLogicalAccount}`);
                }
                binding.accountDependencies.push(dependsOnAccountBinding.physicalId);
            }

            if (!stored || stored.lastCommittedHash !== templateHash) {
                binding.action = 'UpdateOrCreate';
            }

            result.push(binding);
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

        for (const storedTarget of this.state.enumTargets(this.stackName)) {
            const accountId = storedTarget.accountId;
            const region = storedTarget.region;
            const stackName = storedTarget.stackName;
            if (!targetsInTemplate.find((element) => element.accountId === accountId && element.region === region && element.stackName === stackName)) {
                result.push({
                    accountId,
                    region,
                    stackName,
                    templateHash,
                    action: 'Delete',
                    state: storedTarget,
                    dependencies: [],
                    dependents: [],
                    regionDependencies: [],
                    accountDependencies: [],
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
                task.dependentTaskFilter = (other) => {
                    return binding.accountDependencies.includes(other.accountId) ||
                           binding.regionDependencies.includes(other.region) ||
                           binding.dependencies.findIndex((x) => x.outputAccountId === other.accountId && x.outputRegion === other.region && x.outputStackName === other.stackName) > -1;
                };
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
    templateHash: string;
    state?: ICfnTarget;
    template?: CfnTemplate;
    dependencies: ICfnCrossAccountDependency[];
    dependents: ICfnCrossAccountDependency[];
    accountDependencies: string[];
    regionDependencies: string[];
}

export interface ICfnCrossAccountDependency {
    parameterAccountId: string;
    parameterRegion: string;
    parameterStackName: string;
    parameterType: string;
    parameterName: string;
    outputAccountId: string;
    outputRegion: string;
    outputStackName: string;
    outputName: string;
    outputValueExpression: ICfnValue;
}

type CfnBindingAction = 'UpdateOrCreate' | 'Delete' | 'None';

export interface ICfnRefValue { Ref: string; }
export interface ICfnGetAttValue  { 'Fn::GetAtt': string[]; }
export interface ICfnJoinValue  { 'Fn::Join': ICfnValue[]; }
export interface ICfnSubValue  { 'Fn::Sub': any; }
export type ICfnValue = string | ICfnRefValue  | ICfnGetAttValue | ICfnJoinValue;
