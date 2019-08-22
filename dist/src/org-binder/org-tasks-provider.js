"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const resource_types_1 = require("../parser/model/resource-types");
const parser_1 = require("../parser/parser");
class TaskProvider {
    constructor(currentTemplate, persistedState, writer) {
        this.writer = writer;
        this.state = persistedState;
        const previousTemplate = persistedState.getPreviousTemplate();
        this.previousTemplate = parser_1.TemplateRoot.createFromContents(previousTemplate, currentTemplate.dirname);
    }
    createPolicyCreateTasks(resource, hash) {
        const that = this;
        return [{
                type: resource.type,
                logicalId: resource.logicalId,
                action: 'Create',
                perform: async () => {
                    const physicalId = await that.writer.createPolicy(resource);
                    that.state.setBinding({
                        type: resource.type,
                        logicalId: resource.logicalId,
                        lastCommittedHash: hash,
                        physicalId,
                    });
                },
            }];
    }
    createPolicyUpdateTasks(resource, physicalId, hash) {
        const that = this;
        return [{
                type: resource.type,
                logicalId: resource.logicalId,
                action: 'Update',
                perform: async () => {
                    await that.writer.updatePolicy(resource, physicalId);
                    that.state.setBinding({
                        type: resource.type,
                        logicalId: resource.logicalId,
                        lastCommittedHash: hash,
                        physicalId,
                    });
                },
            }];
    }
    createPolicyDeleteTasks(binding) {
        const that = this;
        return [{
                type: binding.type,
                logicalId: binding.logicalId,
                action: 'Delete',
                perform: async () => {
                    await that.writer.deletePolicy(binding.physicalId);
                    this.state.removeBinding(binding);
                },
            }];
    }
    createOrganizationalUnitCreateTasks(resource, hash) {
        const that = this;
        const tasks = [];
        const createOrganizationalUnitTask = {
            type: resource.type,
            logicalId: resource.logicalId,
            action: 'Create',
            perform: async (task) => {
                task.result = await that.writer.createOrganizationalUnit(resource);
            },
        };
        tasks.push(createOrganizationalUnitTask);
        for (const attachedSCP of resource.serviceControlPolicies) {
            const attachSCPTask = this.createAttachSCPTask(resource, attachedSCP, that, () => createOrganizationalUnitTask.result);
            attachSCPTask.dependentTasks = [createOrganizationalUnitTask];
            tasks.push(attachSCPTask);
        }
        for (const attachedAccount of resource.accounts) {
            const attachAccountTask = {
                type: resource.type,
                logicalId: resource.logicalId,
                action: 'Relate',
                dependentTasks: [createOrganizationalUnitTask],
                perform: async (task) => {
                    let accountId = attachedAccount.PhysicalId;
                    if (accountId === undefined) {
                        const binding = that.state.getBinding(resource_types_1.OrgResourceTypes.Account, attachedAccount.TemplateResource.logicalId);
                        accountId = binding.physicalId;
                    }
                    task.result = await that.writer.attachAccount(createOrganizationalUnitTask.result, accountId);
                },
            };
            if (attachedAccount.TemplateResource && undefined === that.state.getBinding(resource_types_1.OrgResourceTypes.Account, attachedAccount.TemplateResource.logicalId)) {
                attachAccountTask.dependentTaskFilter = (task) => task.logicalId === attachedAccount.TemplateResource.logicalId &&
                    task.action === 'Create' &&
                    task.type === resource_types_1.OrgResourceTypes.Account;
            }
            tasks.push(attachAccountTask);
        }
        const createOrganizationalUnitCommitHashTask = {
            type: resource.type,
            logicalId: resource.logicalId,
            action: 'CommitHash',
            dependentTasks: tasks,
            perform: async (task) => {
                that.state.setBinding({
                    type: resource.type,
                    logicalId: resource.logicalId,
                    lastCommittedHash: hash,
                    physicalId: createOrganizationalUnitTask.result,
                });
            },
        };
        return [...tasks, createOrganizationalUnitCommitHashTask];
    }
    createOrganizationalUnitUpdateTasks(resource, physicalId, hash) {
        const that = this;
        const tasks = [];
        const previousResource = this.previousTemplate.organizationSection.organizationalUnits.find((x) => x.logicalId === resource.logicalId);
        if (previousResource === undefined || previousResource.organizationalUnitName !== resource.organizationalUnitName) {
            const updateOrganizationalUnitTask = {
                type: resource.type,
                logicalId: resource.logicalId,
                action: 'Update',
                perform: async (task) => {
                    task.result = await that.writer.updateOrganizationalUnit(resource, physicalId);
                },
            };
            tasks.push(updateOrganizationalUnitTask);
        }
        const previousSCPs = this.resolveIDs(previousResource.serviceControlPolicies);
        const currentSCPS = this.resolveIDs(resource.serviceControlPolicies);
        for (const attachedSCP of currentSCPS.physicalIds.filter((x) => !previousSCPs.physicalIds.includes(x))) {
            const attachSCPTask = this.createAttachSCPTask(resource, { PhysicalId: attachedSCP }, that, () => physicalId);
            tasks.push(attachSCPTask);
        }
        for (const attachedSCP of currentSCPS.unresolvedResources) {
            const attachSCPTask = this.createAttachSCPTask(resource, { TemplateResource: attachedSCP }, that, () => physicalId);
            tasks.push(attachSCPTask);
        }
        for (const detachedSCP of previousSCPs.physicalIds.filter((x) => !currentSCPS.physicalIds.includes(x))) {
            const detachSCPTask = this.createDetachSCPTask(resource, detachedSCP, that, physicalId);
            tasks.push(detachSCPTask);
        }
        const previousAccounts = this.resolveIDs(previousResource.accounts);
        const currentAccounts = this.resolveIDs(resource.accounts);
        for (const attachAccount of currentAccounts.physicalIds.filter((x) => !previousAccounts.physicalIds.includes(x))) {
            const attachAccountTask = this.createAttachAccountTask(resource, { PhysicalId: attachAccount }, that, () => physicalId);
            tasks.push(attachAccountTask);
        }
        for (const attachAccount of currentAccounts.unresolvedResources) {
            const attachAccountTask = this.createAttachAccountTask(resource, { TemplateResource: attachAccount }, that, () => physicalId);
            tasks.push(attachAccountTask);
        }
        const createOrganizationalUnitCommitHashTask = {
            type: resource.type,
            logicalId: resource.logicalId,
            action: 'CommitHash',
            dependentTasks: tasks,
            perform: async (task) => {
                that.state.setBinding({
                    type: resource.type,
                    logicalId: resource.logicalId,
                    lastCommittedHash: hash,
                    physicalId,
                });
            },
        };
        return [...tasks, createOrganizationalUnitCommitHashTask];
    }
    createOrganizationalUnitDeleteTasks(binding) {
        const that = this;
        return [{
                type: binding.type,
                logicalId: binding.logicalId,
                action: 'Delete',
                perform: async () => {
                    await that.writer.deleteOrganizationalUnit(binding.physicalId);
                    this.state.removeBinding(binding);
                },
            }];
    }
    createAccountCreateTasks(resource, hash) {
        const that = this;
        const tasks = [];
        const createAccountTask = {
            type: resource.type,
            logicalId: resource.logicalId,
            action: 'Create',
            perform: async (task) => {
                task.result = await that.writer.createAccount(resource);
            },
        };
        tasks.push(createAccountTask);
        for (const attachedSCP of resource.serviceControlPolicies) {
            const attachSCPTask = this.createAttachSCPTask(resource, attachedSCP, that, () => createAccountTask.result);
            attachSCPTask.dependentTasks = [createAccountTask];
            tasks.push(attachSCPTask);
        }
        const createAccountCommitHashTask = {
            type: resource.type,
            logicalId: resource.logicalId,
            action: 'CommitHash',
            dependentTasks: tasks,
            perform: async (task) => {
                that.state.setBinding({
                    type: resource.type,
                    logicalId: resource.logicalId,
                    lastCommittedHash: hash,
                    physicalId: createAccountTask.result,
                });
            },
        };
        return [...tasks, createAccountCommitHashTask];
    }
    createDetachSCPTask(resource, physicalId, that, targetId) {
        return {
            type: resource.type,
            logicalId: resource.logicalId,
            action: 'Relate',
            perform: async (task) => {
                task.result = await that.writer.detachPolicy(targetId, physicalId);
            },
        };
    }
    createAttachSCPTask(resource, policy, that, getTargetId) {
        const attachSCPTask = {
            type: resource.type,
            logicalId: resource.logicalId,
            action: 'Relate',
            perform: async (task) => {
                let policyId = policy.PhysicalId;
                if (policyId === undefined) {
                    const binding = that.state.getBinding(resource_types_1.OrgResourceTypes.ServiceControlPolicy, policy.TemplateResource.logicalId);
                    policyId = binding.physicalId;
                }
                const targetId = getTargetId();
                task.result = await that.writer.attachPolicy(targetId, policyId);
            },
        };
        if (policy.TemplateResource && undefined === that.state.getBinding(resource_types_1.OrgResourceTypes.ServiceControlPolicy, policy.TemplateResource.logicalId)) {
            attachSCPTask.dependentTaskFilter = (task) => task.logicalId === policy.TemplateResource.logicalId &&
                task.action === 'Create' &&
                task.type === resource_types_1.OrgResourceTypes.ServiceControlPolicy;
        }
        return attachSCPTask;
    }
    createAttachAccountTask(resource, account, that, getTargetId) {
        const attachAccountTask = {
            type: resource.type,
            logicalId: resource.logicalId,
            action: 'Relate',
            perform: async (task) => {
                let accountId = account.PhysicalId;
                if (accountId === undefined) {
                    const binding = that.state.getBinding(resource_types_1.OrgResourceTypes.Account, account.TemplateResource.logicalId);
                    accountId = binding.physicalId;
                }
                const targetId = getTargetId();
                task.result = await that.writer.attachAccount(targetId, accountId);
            },
        };
        if (account.TemplateResource && undefined === that.state.getBinding(resource_types_1.OrgResourceTypes.Account, account.TemplateResource.logicalId)) {
            attachAccountTask.dependentTaskFilter = (task) => task.logicalId === account.TemplateResource.logicalId &&
                task.action === 'Create' &&
                task.type === resource_types_1.OrgResourceTypes.Account;
        }
        return attachAccountTask;
    }
    resolveIDs(list) {
        const physicalIdsForServiceControlPolicies = list.filter((x) => x.PhysicalId).map((x) => x.PhysicalId);
        const unresolvedResources = [];
        for (const logicalRef of list.filter((x) => x.TemplateResource).map((x) => x.TemplateResource)) {
            const binding = this.state.getBinding(logicalRef.type, logicalRef.logicalId);
            if (binding === undefined) {
                unresolvedResources.push(logicalRef);
            }
            else {
                physicalIdsForServiceControlPolicies.push(binding.physicalId);
            }
        }
        return { physicalIds: physicalIdsForServiceControlPolicies.sort(), unresolvedResources };
    }
}
exports.TaskProvider = TaskProvider;
//# sourceMappingURL=org-tasks-provider.js.map