"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const resource_types_1 = require("../parser/model/resource-types");
const cfn_task_provider_1 = require("./cfn-task-provider");
const cfn_transform_1 = require("./cfn-transform");
class CloudFormationBinder {
    constructor(template, state, taskProvider = new cfn_task_provider_1.CfnTaskProvider(state), templateTransform = new cfn_transform_1.CfnTransform(template, state)) {
        this.template = template;
        this.masterAccount = template.organizationSection.masterAccount.accountId;
        this.state = state;
        this.taskProvider = taskProvider;
        this.templateTransform = templateTransform;
        if (this.state.masterAccount !== this.masterAccount) {
            throw new Error('state and template do not belong to the same organization');
        }
    }
    enumBindings() {
        const result = [];
        const targetsInTemplate = new Set();
        const targets = this.template.resourcesSection.enumTemplateTargets();
        for (const target of targets) {
            const accountId = this.state.getBinding(resource_types_1.OrgResourceTypes.Account, target.accountLogicalId).physicalId;
            const region = target.region;
            const stackName = this.template.stackName;
            const key = { accountId, region, stackName };
            targetsInTemplate.add(key);
            const cfnTarget = this.state.getTarget(stackName, accountId, region);
            if (cfnTarget === undefined) {
                result.push(Object.assign({}, key, { action: 'UpdateOrCreate', template: target, templateHash: target.hash }));
            }
            else {
                const storedHash = cfnTarget.lastCommittedHash;
                if (target.hash !== storedHash) {
                    result.push(Object.assign({}, key, { action: 'UpdateOrCreate', template: target, state: cfnTarget, templateHash: target.hash }));
                }
            }
        }
        for (const storedTargets of this.state.enumTargets()) {
            const accountId = storedTargets.accountId;
            const region = storedTargets.region;
            const stackName = storedTargets.stackName;
            if (!targetsInTemplate.has({ accountId, region, stackName })) {
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
    enumTasks() {
        const result = [];
        for (const binding of this.enumBindings()) {
            if (binding.action === 'UpdateOrCreate') {
                const template = this.templateTransform.createTemplateForBinding(binding.template);
                const task = this.taskProvider.createUpdateTemplateTask(binding, template, binding.template.hash);
                result.push(...task);
            }
            else if (binding.action === 'Delete') {
                const task = this.taskProvider.createDeleteTemplateTask(binding);
                result.push(...task);
            }
        }
        return result;
    }
}
exports.CloudFormationBinder = CloudFormationBinder;
//# sourceMappingURL=cfn-binder.js.map