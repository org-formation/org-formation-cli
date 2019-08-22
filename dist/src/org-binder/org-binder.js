"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const resource_types_1 = require("../parser/model/resource-types");
class OrganizationBinder {
    constructor(template, state, taskProvider) {
        this.template = template;
        this.taskProvider = taskProvider;
        this.masterAccount = template.organizationSection.masterAccount.accountId;
        this.state = state;
        if (this.state.masterAccount !== this.masterAccount) {
            throw new Error('state and template do not belong to the same organization');
        }
    }
    getBindings() {
        return {
            organization: this.getOrganizationBindings(),
        };
    }
    getOrganizationBindings() {
        const policies = Array.from(ServiceControlPolicyBinding.enumerateServiceControlBindings(this.template, this.state));
        const organizationalUnits = Array.from(OrganizationalUnitBinding.enumerateOrganizationalUnitBindings(this.template, this.state));
        const accounts = Array.from(AccountBinding.enumerateAccountBindings(this.template, this.state));
        const masterAccount = Binding.getBinding(this.state, this.template.organizationSection.masterAccount);
        return {
            policies,
            organizationalUnits,
            accounts,
            masterAccount,
        };
    }
    enumBuildTasks() {
        const tasks = [];
        const org = this.getOrganizationBindings();
        for (const boundPolicy of org.policies) {
            switch (boundPolicy.action) {
                case 'Create':
                    const t = this.taskProvider.createPolicyCreateTasks(boundPolicy.template, boundPolicy.templateHash);
                    tasks.push(...t);
                    break;
                case 'Update':
                    const t2 = this.taskProvider.createPolicyUpdateTasks(boundPolicy.template, boundPolicy.state.physicalId, boundPolicy.templateHash);
                    tasks.push(...t2);
                    break;
                case 'Delete':
                    const t3 = this.taskProvider.createPolicyDeleteTasks(boundPolicy.state);
                    tasks.push(...t3);
                    break;
            }
        }
        for (const boundPolicy of org.accounts) {
            switch (boundPolicy.action) {
                case 'Create':
                    const t1 = this.taskProvider.createAccountCreateTasks(boundPolicy.template, boundPolicy.templateHash);
                    tasks.push(...t1);
                    break;
                case 'Update':
                    // console.log(`updating policy '${boundPolicy.template.logicalId}' (${boundPolicy.state.physicalId})`);
                    // await writer.updateAccount(boundPolicy.template, boundPolicy.state.physicalId);
                    // this.state.setBinding({
                    //     type: boundPolicy.template.type,
                    //     logicalId: boundPolicy.template.logicalId,
                    //     lastCommittedHash: boundPolicy.templateHash,
                    //     physicalId: boundPolicy.state.physicalId,
                    // });
                    break;
                case 'Delete':
                    // console.log(`deleting policy '${boundPolicy.state.physicalId}'`);
                    // await writer.deleteAccount(boundPolicy.state.physicalId);
                    // this.state.removeBinding(boundPolicy.state);
                    break;
            }
        }
        for (const boundPolicy of org.organizationalUnits) {
            switch (boundPolicy.action) {
                case 'Create':
                    const t1 = this.taskProvider.createOrganizationalUnitCreateTasks(boundPolicy.template, boundPolicy.templateHash);
                    tasks.push(...t1);
                    break;
                case 'Update':
                    const t2 = this.taskProvider.createOrganizationalUnitUpdateTasks(boundPolicy.template, boundPolicy.state.physicalId, boundPolicy.templateHash);
                    tasks.push(...t2);
                    break;
                case 'Delete':
                    const t3 = this.taskProvider.createOrganizationalUnitDeleteTasks(boundPolicy.state);
                    tasks.push(...t3);
                    break;
            }
        }
        return tasks;
    }
}
exports.OrganizationBinder = OrganizationBinder;
class BindingRoot {
}
exports.BindingRoot = BindingRoot;
class OrganizationBinding {
}
exports.OrganizationBinding = OrganizationBinding;
class Binding {
    static getBinding(state, templateResource) {
        const savedBinding = state.getBinding(templateResource.type, templateResource.logicalId);
        const hash = templateResource.calculateHash();
        if (savedBinding === undefined) {
            return {
                action: 'Create',
                template: templateResource,
                templateHash: hash,
            };
        }
        else if (hash !== savedBinding.lastCommittedHash) {
            return {
                action: 'Update',
                template: templateResource,
                state: savedBinding,
                templateHash: hash,
            };
        }
        else {
            return {
                action: 'None',
                template: templateResource,
                state: savedBinding,
                templateHash: hash,
            };
        }
    }
    static enumerateBindings(type, templateResources, state) {
        const savedBindings = state.enumBindings(type);
        const result = [];
        for (const templateResource of templateResources) {
            const binding = Binding.getBinding(state, templateResource);
            result.push(binding);
        }
        for (const savedBinding of savedBindings) {
            if (!templateResources.find((x) => x.logicalId === savedBinding.logicalId)) {
                const binding = {
                    action: 'Delete',
                    state: savedBinding,
                };
                result.push(binding);
            }
        }
        return result;
    }
}
class AccountBinding extends Binding {
    static enumerateAccountBindings(template, state) {
        return Binding.enumerateBindings(resource_types_1.OrgResourceTypes.Account, template.organizationSection.accounts, state);
    }
}
class OrganizationalUnitBinding extends Binding {
    static enumerateOrganizationalUnitBindings(template, state) {
        return Binding.enumerateBindings(resource_types_1.OrgResourceTypes.OrganizationalUnit, template.organizationSection.organizationalUnits, state);
    }
}
class ServiceControlPolicyBinding extends Binding {
    static enumerateServiceControlBindings(template, state) {
        return Binding.enumerateBindings(resource_types_1.OrgResourceTypes.ServiceControlPolicy, template.organizationSection.serviceControlPolicies, state);
    }
}
//# sourceMappingURL=org-binder.js.map