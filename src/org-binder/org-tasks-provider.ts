import { ConsoleUtil } from '../util/console-util';
import { AwsOrganizationWriter } from '~aws-provider/aws-organization-writer';
import {
    AccountResource,
    OrganizationRootResource,
    OrganizationalUnitResource,
    OrgResourceTypes,
    PasswordPolicyResource,
    Reference,
    Resource,
    ServiceControlPolicyResource,
} from '~parser/model';
import { TemplateRoot } from '~parser/parser';
import { IBinding, PersistedState } from '~state/persisted-state';

const IS_PARTITION = true;
const IS_COMMERCIAL = false;

export class TaskProvider {
    protected state: PersistedState;
    protected previousTemplate: TemplateRoot;
    protected writer: AwsOrganizationWriter;
    private partitionWriter: AwsOrganizationWriter;

    constructor(currentTemplate: TemplateRoot, persistedState: PersistedState, writer: AwsOrganizationWriter, partitionWriter?: AwsOrganizationWriter) {
        this.writer = writer;
        this.partitionWriter = partitionWriter;
        this.state = persistedState;
        try {
            const previousTemplate = persistedState.getPreviousTemplate();
            if (previousTemplate) {
                this.previousTemplate = TemplateRoot.createFromContents(previousTemplate, currentTemplate.dirname);
            } else {
                this.previousTemplate = TemplateRoot.createEmpty();
            }
        } catch (err) {
            ConsoleUtil.LogInfo(`unable to load previous state, using empty template instead. reason: ${err}`);
            this.previousTemplate = TemplateRoot.createEmpty();
        }
    }

    public createRootCreateTasks(resource: OrganizationRootResource, hash: string, mirror?: boolean): IBuildTask[] {
        const that = this;
        const tasks: IBuildTask[] = [];
        let partitionId: string;
        let createPartitionOrganizationRootTask: IBuildTask;
        const createOrganizationRootTask: IBuildTask = {
            type: resource.type,
            logicalId: resource.logicalId,
            action:  'Create',
            perform: async task => {
                task.result = await that.writer.ensureRoot();
            },
        };
        tasks.push(createOrganizationRootTask);
        const physicalId = createOrganizationRootTask.result;
        if (mirror) {
            createPartitionOrganizationRootTask = {
                type: resource.type,
                logicalId: resource.logicalId,
                action:  'Create',
                perform: async task => {
                    task.result = await that.partitionWriter.ensureRoot();
                },
            };
            tasks.push(createPartitionOrganizationRootTask);
            partitionId = createPartitionOrganizationRootTask.result;
        }

        for (const attachedSCP of resource.serviceControlPolicies) {
            const attachSCPTask: IBuildTask = this.createAttachSCPTask(resource, attachedSCP, that, () => physicalId, IS_COMMERCIAL);
            attachSCPTask.dependentTasks = [createOrganizationRootTask];
            tasks.push(attachSCPTask);
            if (mirror) {
                const attachPartitionSCPTask: IBuildTask = this.createAttachSCPTask(resource, attachedSCP, that, () => partitionId, IS_PARTITION);
                attachPartitionSCPTask.dependentTasks = [createPartitionOrganizationRootTask];
                tasks.push(attachPartitionSCPTask);
            }
        }

        const createOrganizationRootCommitHashTask: IBuildTask = {
            type: resource.type,
            logicalId: resource.logicalId,
            action:  'CommitHash',
            dependentTasks: tasks,
            perform: async () => {
                that.state.setUniqueBindingForType({
                    type: resource.type,
                    logicalId: resource.logicalId,
                    lastCommittedHash: hash,
                    physicalId,
                    partitionId,
                });
            },
        };

        return [...tasks, createOrganizationRootCommitHashTask];
    }

    public createRootUpdateTasks(resource: OrganizationRootResource, state: IBinding, hash: string, mirror?: boolean): IBuildTask[] {
        const that = this;
        const physicalId: string = state.physicalId;
        const partitionId: string = state.partitionId;
        const tasks: IBuildTask[] = [];
        const previousResource = this.previousTemplate.organizationSection.organizationRoot;
        const previosuServiceControlPolicies = previousResource ? previousResource.serviceControlPolicies : [];

        const previousSCPs = this.resolveIDs(previosuServiceControlPolicies);
        const currentSCPS = this.resolveIDs(resource.serviceControlPolicies);
        for (const attachedSCP of currentSCPS.physicalIds.filter(x => !previousSCPs.physicalIds.includes(x))) {
            const attachSCPTask: IBuildTask = this.createAttachSCPTask(resource, currentSCPS.mapping[attachedSCP], that, () => physicalId, IS_COMMERCIAL);
            tasks.push(attachSCPTask);
        }
        for (const attachedSCP of currentSCPS.unresolvedResources) {
            const attachSCPTask: IBuildTask = this.createAttachSCPTask(resource, { TemplateResource: attachedSCP as ServiceControlPolicyResource }, that, () => physicalId, IS_COMMERCIAL);
            tasks.push(attachSCPTask);
        }
        for (const detachedSCP of previousSCPs.physicalIds.filter(x => !currentSCPS.physicalIds.includes(x))) {
            const detachSCPTask: IBuildTask = this.createDetachSCPTask(resource, previousSCPs.mapping[detachedSCP], that, () => physicalId, IS_COMMERCIAL);
            tasks.push(detachSCPTask);
        }

        if (mirror) {
            for (const attachedSCP of currentSCPS.partitionIds.filter(x => !previousSCPs.partitionIds.includes(x))) {
                const attachSCPTask: IBuildTask = this.createAttachSCPTask(resource, currentSCPS.mapping[attachedSCP], that, () => partitionId, IS_PARTITION);
                tasks.push(attachSCPTask);
            }
            for (const attachedSCP of currentSCPS.unresolvedResources) {
                const attachSCPTask: IBuildTask = this.createAttachSCPTask(resource, { TemplateResource: attachedSCP as ServiceControlPolicyResource }, that, () => partitionId, IS_PARTITION);
                tasks.push(attachSCPTask);
            }
            for (const detachedSCP of previousSCPs.partitionIds.filter(x => !currentSCPS.partitionIds.includes(x))) {
                const detachSCPTask: IBuildTask = this.createDetachSCPTask(resource, previousSCPs.mapping[detachedSCP], that, () => partitionId, IS_PARTITION);
                tasks.push(detachSCPTask);
            }
        }

        const createOrganizationalUnitCommitHashTask: IBuildTask = {
            type: resource.type,
            logicalId: resource.logicalId,
            action:  'CommitHash',
            dependentTasks: tasks,
            perform: async () => {
                that.state.setUniqueBindingForType({
                    type: resource.type,
                    logicalId: resource.logicalId,
                    lastCommittedHash: hash,
                    physicalId,
                    partitionId,
                });
            },
        };

        return [...tasks, createOrganizationalUnitCommitHashTask];
    }

    public createPolicyCreateTasks(resource: ServiceControlPolicyResource, hash: string, mirror?: boolean): IBuildTask[] {
        const that = this;
        const tasks: IBuildTask[] = [];
        let createPartitionPolicyTask: IBuildTask;
        const createPolicyTask: IBuildTask = {
            type: resource.type,
            logicalId: resource.logicalId,
            action: 'Create',
            perform: async (task): Promise<void> => {
                task.result = await that.writer.createPolicy(resource);
            },
        };
        tasks.push(createPolicyTask);

        if (mirror) {
            createPartitionPolicyTask = {
                type: resource.type,
                logicalId: resource.logicalId,
                action: 'Create',
                perform: async (task): Promise<void> => {
                    task.result = await that.partitionWriter.createPolicy(resource);
                },
            };
            tasks.push(createPartitionPolicyTask);
        }

        const createPolicyCommitHashTask: IBuildTask = {
            type: resource.type,
            logicalId: resource.logicalId,
            action:  'CommitHash',
            dependentTasks: tasks,
            perform: async () => {
                that.state.setBinding({
                    type: resource.type,
                    logicalId: resource.logicalId,
                    lastCommittedHash: hash,
                    physicalId: createPolicyTask.result,
                    partitionId: createPartitionPolicyTask.result,
                });
            },
        };

        return [...tasks, createPolicyCommitHashTask];

    }

    public createPolicyUpdateTasks(resource: ServiceControlPolicyResource, state: IBinding, hash: string, mirror?: boolean): IBuildTask[] {
        const that = this;
        const tasks: IBuildTask[] = [];
        const physicalId: string = state.physicalId;
        const partitionId: string = state.partitionId;
        tasks.push({
            type: resource.type,
            logicalId: resource.logicalId,
            action: 'Update',
            perform: async (): Promise<void> => {
                await that.writer.updatePolicy(resource, physicalId);
            },
        });
        if (mirror) {
            tasks.push({
                type: resource.type,
                logicalId: resource.logicalId,
                action: 'Update',
                perform: async (): Promise<void> => {
                    await that.partitionWriter.updatePolicy(resource, partitionId);
                },
            });
        }
        const createPolicyCommitHashTask: IBuildTask = {
            type: resource.type,
            logicalId: resource.logicalId,
            action:  'CommitHash',
            dependentTasks: tasks,
            perform: async () => {
                that.state.setBinding({
                    type: resource.type,
                    logicalId: resource.logicalId,
                    lastCommittedHash: hash,
                    physicalId,
                    partitionId,
                });
            },
        };

        return [...tasks, createPolicyCommitHashTask];
    }

    public createPolicyDeleteTasks(binding: IBinding, mirror?: boolean): IBuildTask[] {
        const that = this;
        return [{
            type: binding.type,
            logicalId: binding.logicalId,
            action: 'Delete',
            dependentTaskFilter: (): boolean => true,
            perform: async (): Promise<void> => {
                await that.writer.deletePolicy(binding.physicalId);
                if (mirror) {
                    await that.partitionWriter.deletePolicy(binding.partitionId);
                }
                this.state.removeBinding(binding);
            },
        }];
    }

    public createOrganizationalUnitCreateTasks(resource: OrganizationalUnitResource, hash: string, mirror?: boolean): IBuildTask[] {
        const that = this;
        const tasks: IBuildTask[] = [];
        const dependency: IBuildTask[] = [];
        let createPartitionOrganizationalUnitTask: IBuildTask;
        const createOrganizationalUnitTask: IBuildTask = {
            type: resource.type,
            logicalId: resource.logicalId,
            action:  'Create',
            dependentTaskFilter: task => task.action === 'Delete' && task.type === resource.type,
            perform: async (task): Promise<void> => {
                let parentId: string;
                if (resource.parentOULogicalName) {
                    const binding = that.state.getBinding(OrgResourceTypes.OrganizationalUnit, resource.parentOULogicalName);
                    if (binding) {
                        parentId = binding.physicalId;
                    }
                }
                task.result = await that.writer.createOrganizationalUnit(resource, parentId);
                that.state.setBinding({
                    type: resource.type,
                    logicalId: resource.logicalId,
                    lastCommittedHash: hash,
                    physicalId: task.result,
                    partitionId: '',
                });
            },
        };
        tasks.push(createOrganizationalUnitTask);
        dependency.push(createOrganizationalUnitTask);
        if (mirror) {
            createPartitionOrganizationalUnitTask = {
                type: resource.type,
                logicalId: resource.logicalId,
                action:  'Create',
                dependentTaskFilter: task => task.action === 'Delete' && task.type === resource.type,
                perform: async (task): Promise<void> => {
                    let parentId: string;
                    if (resource.parentOULogicalName) {
                        const binding = that.state.getBinding(OrgResourceTypes.OrganizationalUnit, resource.parentOULogicalName);
                        if (binding) {
                            parentId = binding.partitionId;
                        }
                    }
                    task.result = await that.partitionWriter.createOrganizationalUnit(resource, parentId);
                    that.state.setBinding({
                        type: resource.type,
                        logicalId: resource.logicalId,
                        lastCommittedHash: hash,
                        physicalId: createOrganizationalUnitTask.result,
                        partitionId: task.result,
                    });
                },
            };
            createPartitionOrganizationalUnitTask.dependentTasks = [createOrganizationalUnitTask];
            tasks.push(createPartitionOrganizationalUnitTask);
            dependency.push(createPartitionOrganizationalUnitTask);
        }

        for (const attachedSCP of resource.serviceControlPolicies) {
            const attachSCPTask: IBuildTask = this.createAttachSCPTask(resource, attachedSCP, that, () => createOrganizationalUnitTask.result, IS_COMMERCIAL);
            attachSCPTask.dependentTasks = dependency;
            tasks.push(attachSCPTask);
        }
        for (const attachedAccount of resource.accounts) {
            const attachAccountTask = this.createAttachAccountTask(resource, attachedAccount, that, () => createOrganizationalUnitTask.result, IS_COMMERCIAL);
            attachAccountTask.dependentTasks = dependency;
            tasks.push(attachAccountTask);
        }
        for (const attachedOu of resource.organizationalUnits) {
            const attachOuTask = this.createAttachOrganizationalUnitTask(resource, attachedOu, that, () => createOrganizationalUnitTask.result, IS_COMMERCIAL);
            attachOuTask.dependentTasks = dependency;
            tasks.push(attachOuTask);
        }
        if (mirror) {
            for (const attachedSCP of resource.serviceControlPolicies) {
                const attachSCPTask: IBuildTask = this.createAttachSCPTask(resource, attachedSCP, that, () => createPartitionOrganizationalUnitTask.result, IS_PARTITION);
                attachSCPTask.dependentTasks = dependency;
                tasks.push(attachSCPTask);
            }
            for (const attachedAccount of resource.accounts) {
                const attachAccountTask = this.createAttachAccountTask(resource, attachedAccount, that, () => createPartitionOrganizationalUnitTask.result, IS_PARTITION);
                attachAccountTask.dependentTasks = dependency;
                tasks.push(attachAccountTask);
            }
            for (const attachedOu of resource.organizationalUnits) {
                const attachOuTask = this.createAttachOrganizationalUnitTask(resource, attachedOu, that, () => createPartitionOrganizationalUnitTask.result, IS_PARTITION);
                attachOuTask.dependentTasks = dependency;
                tasks.push(attachOuTask);
            }
        }

        const createOrganizationalUnitCommitHashTask: IBuildTask = {
            type: resource.type,
            logicalId: resource.logicalId,
            action:  'CommitHash',
            dependentTasks: tasks,
            perform: async (): Promise<void> => {
                that.state.setBindingHash(resource.type, resource.logicalId, hash);
            },
        };

        return [...tasks, createOrganizationalUnitCommitHashTask];
    }

    public createOrganizationalUnitUpdateTasks(resource: OrganizationalUnitResource, state: IBinding,  hash: string, mirror?: boolean): IBuildTask[] {
        const that = this;
        const physicalId: string = state.physicalId;
        const partitionId: string = state.partitionId;
        const tasks: IBuildTask[] = [];
        const previousResource = this.previousTemplate.organizationSection.organizationalUnits.find(x => x.logicalId === resource.logicalId);

        if (previousResource === undefined || previousResource.organizationalUnitName !== resource.organizationalUnitName) {
            tasks.push({
                type: resource.type,
                logicalId: resource.logicalId,
                action:  'Update',
                perform: async (task): Promise<void> => {
                    task.result = await that.writer.updateOrganizationalUnit(resource, physicalId);
                },
            });
            if (mirror) {
                tasks.push({
                    type: resource.type,
                    logicalId: resource.logicalId,
                    action:  'Update',
                    perform: async (task): Promise<void> => {
                        task.result = await that.partitionWriter.updateOrganizationalUnit(resource, partitionId);
                    },
                });
            }
        };

        const fnGetPhysicalId = (): string => {
            return this.state.getBinding(OrgResourceTypes.OrganizationalUnit, resource.logicalId).physicalId;
        };
        const FnGetpartitionId = (): string => {
            return this.state.getBinding(OrgResourceTypes.OrganizationalUnit, resource.logicalId).partitionId;
        };

        const previousSCPs = this.resolveIDs(previousResource === undefined ? [] : previousResource.serviceControlPolicies);
        const currentSCPS = this.resolveIDs(resource.serviceControlPolicies);
        for (const detachedSCP of previousSCPs.physicalIds.filter(x => !currentSCPS.physicalIds.includes(x))) {
            const detachSCPTask: IBuildTask = this.createDetachSCPTask(resource, previousSCPs.mapping[detachedSCP], that, fnGetPhysicalId, IS_COMMERCIAL);
            tasks.push(detachSCPTask);
        }
        for (const attachedSCP of currentSCPS.physicalIds.filter(x => !previousSCPs.physicalIds.includes(x))) {
            const attachSCPTask: IBuildTask = this.createAttachSCPTask(resource, currentSCPS.mapping[attachedSCP], that, fnGetPhysicalId, IS_COMMERCIAL);
            tasks.push(attachSCPTask);
        }
        for (const attachedSCP of currentSCPS.unresolvedResources) {
            const attachSCPTask: IBuildTask = this.createAttachSCPTask(resource, { TemplateResource: attachedSCP as ServiceControlPolicyResource }, that, fnGetPhysicalId, IS_COMMERCIAL);
            tasks.push(attachSCPTask);
        }
        if (mirror) {
            for (const detachedSCP of previousSCPs.partitionIds.filter(x => !currentSCPS.partitionIds.includes(x))) {
                const detachSCPTask: IBuildTask = this.createDetachSCPTask(resource, previousSCPs.mapping[detachedSCP], that, FnGetpartitionId, IS_PARTITION);
                tasks.push(detachSCPTask);
            }
            for (const attachedSCP of currentSCPS.partitionIds.filter(x => !previousSCPs.partitionIds.includes(x))) {
                const attachSCPTask: IBuildTask = this.createAttachSCPTask(resource, currentSCPS.mapping[attachedSCP], that, FnGetpartitionId, IS_PARTITION);
                tasks.push(attachSCPTask);
            }
            for (const attachedSCP of currentSCPS.unresolvedResources) {
                const attachSCPTask: IBuildTask = this.createAttachSCPTask(resource, { TemplateResource: attachedSCP as ServiceControlPolicyResource }, that, FnGetpartitionId, IS_PARTITION);
                tasks.push(attachSCPTask);
            }
        }

        const previousAccounts = this.resolveIDs(previousResource === undefined ? [] : previousResource.accounts);
        const currentAccounts = this.resolveIDs(resource.accounts);
        for (const detachedAccount of previousAccounts.physicalIds.filter(x => !currentAccounts.physicalIds.includes(x))) {
            const detachAccountTask: IBuildTask = this.createDetachAccountTask(resource, previousAccounts.mapping[detachedAccount], that, fnGetPhysicalId, IS_COMMERCIAL);
            tasks.push(detachAccountTask);
        }
        for (const attachAccount of currentAccounts.physicalIds.filter(x => !previousAccounts.physicalIds.includes(x))) {
            const attachAccountTask: IBuildTask = this.createAttachAccountTask(resource, currentAccounts.mapping[attachAccount], that, fnGetPhysicalId, IS_COMMERCIAL);
            tasks.push(attachAccountTask);
        }
        for (const attachAccount of currentAccounts.unresolvedResources) {
            const attachAccountTask: IBuildTask = this.createAttachAccountTask(resource, { TemplateResource: attachAccount as AccountResource }, that, fnGetPhysicalId, IS_COMMERCIAL);
            tasks.push(attachAccountTask);
        }
        if (mirror) {
            for (const detachedAccount of previousAccounts.partitionIds.filter(x => !currentAccounts.partitionIds.includes(x))) {
                const detachAccountTask: IBuildTask = this.createDetachAccountTask(resource, previousAccounts.mapping[detachedAccount], that, FnGetpartitionId, IS_PARTITION);
                tasks.push(detachAccountTask);
            }
            for (const attachAccount of currentAccounts.partitionIds.filter(x => !previousAccounts.partitionIds.includes(x))) {
                const attachAccountTask: IBuildTask = this.createAttachAccountTask(resource, currentAccounts.mapping[attachAccount], that, FnGetpartitionId, IS_PARTITION);
                tasks.push(attachAccountTask);
            }
            for (const attachAccount of currentAccounts.unresolvedResources) {
                const attachAccountTask: IBuildTask = this.createAttachAccountTask(resource, { TemplateResource: attachAccount as AccountResource }, that, FnGetpartitionId, IS_PARTITION);
                tasks.push(attachAccountTask);
            }
        }

        const previousChildOUs = this.resolveIDs(previousResource === undefined ? [] : previousResource.organizationalUnits);
        const currentChildOUs = this.resolveIDs(resource.organizationalUnits);
        for (const detachedChildOu of previousChildOUs.physicalIds.filter(x => !currentChildOUs.physicalIds.includes(x))) {
            const detachChildOuTask: IBuildTask = this.createDetachChildOUTask(resource, previousChildOUs.mapping[detachedChildOu], that, fnGetPhysicalId, IS_COMMERCIAL);
            tasks.push(detachChildOuTask);
        }
        for (const attachedOU of currentChildOUs.physicalIds.filter(x => !previousChildOUs.physicalIds.includes(x))) {
            const attachOUTask: IBuildTask = this.createAttachOrganizationalUnitTask(resource, currentChildOUs.mapping[attachedOU], that, fnGetPhysicalId, IS_COMMERCIAL);
            tasks.push(attachOUTask);
        }
        for (const attachedOU of currentChildOUs.unresolvedResources) {
            const attachOUTask: IBuildTask = this.createAttachOrganizationalUnitTask(resource, { TemplateResource: attachedOU as OrganizationalUnitResource }, that, fnGetPhysicalId, IS_COMMERCIAL);
            tasks.push(attachOUTask);
        }
        if (mirror) {
            for (const detachedChildOu of previousChildOUs.partitionIds.filter(x => !currentChildOUs.partitionIds.includes(x))) {
                const detachChildOuTask: IBuildTask = this.createDetachChildOUTask(resource, previousChildOUs.mapping[detachedChildOu], that, FnGetpartitionId, IS_PARTITION);
                tasks.push(detachChildOuTask);
            }
            for (const attachedOU of currentChildOUs.partitionIds.filter(x => !previousChildOUs.partitionIds.includes(x))) {
                const attachOUTask: IBuildTask = this.createAttachOrganizationalUnitTask(resource, currentChildOUs.mapping[attachedOU], that, FnGetpartitionId, IS_PARTITION);
                tasks.push(attachOUTask);
            }
            for (const attachedOU of currentChildOUs.unresolvedResources) {
                const attachOUTask: IBuildTask = this.createAttachOrganizationalUnitTask(resource, { TemplateResource: attachedOU as OrganizationalUnitResource }, that, FnGetpartitionId, IS_PARTITION);
                tasks.push(attachOUTask);
            }
        }

        const createOrganizationalUnitCommitHashTask: IBuildTask = {
            type: resource.type,
            logicalId: resource.logicalId,
            action:  'CommitHash',
            dependentTasks: tasks,
            perform: async (): Promise<void> => {
                that.state.setBinding({
                    type: resource.type,
                    logicalId: resource.logicalId,
                    lastCommittedHash: hash,
                    physicalId: fnGetPhysicalId(),
                    partitionId: FnGetpartitionId(),
                });
            },
        };

        return [...tasks, createOrganizationalUnitCommitHashTask];
    }

    public createDetachChildOUTask(resource: OrganizationalUnitResource, childOu: Reference<OrganizationalUnitResource>, that: this, getTargetId: () => string, isPartition?: boolean): IBuildTask {
        const writer = (isPartition) ? that.partitionWriter : that.writer;
        let resourceIdentifier = (isPartition) ? childOu.PartitionId : childOu.PhysicalId;
        if (childOu.TemplateResource) {
            resourceIdentifier = childOu.TemplateResource.logicalId;
        }
        const childLogicalId = childOu.TemplateResource.logicalId;
        const detachChildOuTask: IBuildTask = {
            type: resource.type,
            logicalId: resource.logicalId,
            action: `Detach OU (${resourceIdentifier})`,
            perform: async (task): Promise<void> => {
                const binding = that.state.getBinding(OrgResourceTypes.OrganizationalUnit, childLogicalId);
                if (binding === undefined) {
                    ConsoleUtil.LogDebug(`resource ${childLogicalId} was already deleted`);
                    return;
                }
                const childOuId = (isPartition) ? binding.partitionId : binding.physicalId;

                const targetId = getTargetId();
                let physicalIdMap: Record<string, string> = {};
                try {
                    physicalIdMap = await writer.detachOU(targetId, childOuId);
                }
                finally {
                    TaskProvider.updateStateWithOuPhysicalIds(that.state, physicalIdMap, isPartition);
                }

                task.result = physicalIdMap;
            },
        };
        if (childOu.TemplateResource && undefined === that.state.getBinding(OrgResourceTypes.OrganizationalUnit, childLogicalId)) {
            detachChildOuTask.dependentTaskFilter = (task): boolean => task.logicalId === childLogicalId &&
                (task.action === 'Create') &&
                task.type === OrgResourceTypes.OrganizationalUnit;
        }
        else  {
            detachChildOuTask.dependentTaskFilter = (task): boolean => task.logicalId === childLogicalId &&
                (task.action === 'Delete') &&
                task.type === OrgResourceTypes.OrganizationalUnit;
        }
        return detachChildOuTask;
    }

    public createOrganizationalUnitDeleteTasks(binding: IBinding, mirror?: boolean): IBuildTask[] {
        const that = this;
        const tasks: IBuildTask[] = [];
        const previous = this.previousTemplate.organizationSection.organizationalUnits.find(x=>x.logicalId === binding.logicalId);

        const fnGetPhysicalId = (): string => {
            return this.state.getBinding(OrgResourceTypes.OrganizationalUnit, previous.logicalId).physicalId;
        };
        const fnGetPartitionId = (): string => {
            return this.state.getBinding(OrgResourceTypes.OrganizationalUnit, previous.logicalId).partitionId;
        };


        const previousSCPs = this.resolveIDs(previous.serviceControlPolicies);
        for (const detachedSCP of previousSCPs.physicalIds) {
            const detachSCPTask: IBuildTask = this.createDetachSCPTask(previous, previousSCPs.mapping[detachedSCP], that, fnGetPhysicalId, IS_COMMERCIAL);
            tasks.push(detachSCPTask);
        }
        if (mirror) {
            for (const detachedSCP of previousSCPs.partitionIds) {
                const detachSCPTask: IBuildTask = this.createDetachSCPTask(previous, previousSCPs.mapping[detachedSCP], that, fnGetPartitionId, IS_PARTITION);
                tasks.push(detachSCPTask);
            }
        }

        const previousAccounts = this.resolveIDs(previous.accounts);
        for (const detachedAccount of previousAccounts.physicalIds) {
            const detachAccountTask: IBuildTask = this.createDetachAccountTask(previous, previousAccounts.mapping[detachedAccount], that, fnGetPhysicalId, IS_COMMERCIAL);
            tasks.push(detachAccountTask);
        }
        if (mirror) {
            for (const detachedAccount of previousAccounts.partitionIds) {
                const detachAccountTask: IBuildTask = this.createDetachAccountTask(previous, previousAccounts.mapping[detachedAccount], that, fnGetPartitionId, IS_PARTITION);
                tasks.push(detachAccountTask);
            }
        }

        const previousChildOUs = this.resolveIDs(previous.organizationalUnits);
        for (const detachedChildOu of previousChildOUs.physicalIds) {
            const detachChildOuTask: IBuildTask = this.createDetachChildOUTask(previous, previousChildOUs.mapping[detachedChildOu], that, fnGetPhysicalId, IS_COMMERCIAL);
            tasks.push(detachChildOuTask);
        }
        if (mirror) {
            for (const detachedChildOu of previousChildOUs.partitionIds) {
                const detachChildOuTask: IBuildTask = this.createDetachChildOUTask(previous, previousChildOUs.mapping[detachedChildOu], that, fnGetPartitionId, IS_PARTITION);
                tasks.push(detachChildOuTask);
            }
        }

        const task: IBuildTask = {
            type: binding.type,
            logicalId: binding.logicalId,
            action: 'Delete',
            dependentTasks: tasks,
            perform: async (): Promise<void> => {
                await that.writer.deleteOrganizationalUnit(binding.physicalId);
                if (mirror) {
                    await that.partitionWriter.deleteOrganizationalUnit(binding.partitionId);
                }
                this.state.removeBinding(binding);
            },
        };

        if (previous !== undefined && previous.organizationalUnits.length > 0) {
            task.dependentTaskFilter = (x): boolean => {
                for(const child of previous.organizationalUnits) {
                    if (child.TemplateResource && child.TemplateResource.logicalId === x.logicalId) {
                        return true;
                    }
                }
                return (x.logicalId === binding.logicalId);
            };
        }
        return [...tasks, task];
    }

    public createAccountUpdateTasks(resource: AccountResource, state: IBinding, hash: string, mirror: boolean): IBuildTask[] {
        const that = this;
        const tasks: IBuildTask[] = [];
        const physicalId: string = state.physicalId;
        const partitionId: string = state.partitionId;
        let createAccountTask: IBuildTask;

        let previousResource = [...this.previousTemplate.organizationSection.accounts].find(x => x.logicalId === resource.logicalId);
        if (!previousResource && resource.type === OrgResourceTypes.MasterAccount) {
            previousResource = this.previousTemplate.organizationSection.masterAccount;
        }

        if (previousResource === undefined || previousResource.alias !== resource.alias || previousResource.accountName !== resource.accountName || previousResource.supportLevel !== resource.supportLevel || JSON.stringify(previousResource.tags) !== JSON.stringify(resource.tags)
            || !TaskProvider.policiesEqual(previousResource.passwordPolicy, resource.passwordPolicy)) {
            if (mirror) {
                createAccountTask = {
                    type: resource.type,
                    logicalId: resource.logicalId,
                    action:  'Update',
                    perform: async (task): Promise<void> => {
                        task.result = {
                            commercial: await that.writer.updateAccount(resource, physicalId, previousResource),
                            partition: await that.writer.updatePartitionAccount(resource, partitionId, previousResource),
                        };
                    },
                };
            } else {
                createAccountTask = {
                    type: resource.type,
                    logicalId: resource.logicalId,
                    action:  'Update',
                    perform: async (task): Promise<void> => {
                        task.result = {
                            commercial: await that.writer.updateAccount(resource, physicalId, previousResource),
                        };
                    },
                };
            }
            tasks.push(createAccountTask);
        }
        const previousPolicies = previousResource === undefined ? [] : previousResource.serviceControlPolicies;
        const previousSCPs = this.resolveIDs(previousPolicies);
        const currentSCPS = this.resolveIDs(resource.serviceControlPolicies);
        for (const detachedSCP of previousSCPs.physicalIds.filter(x => !currentSCPS.physicalIds.includes(x))) {
            const detachSCPTask: IBuildTask = this.createDetachSCPTask(resource, previousSCPs.mapping[detachedSCP], that, () => physicalId, IS_COMMERCIAL);
            tasks.push(detachSCPTask);
        }
        for (const attachedSCP of currentSCPS.physicalIds.filter(x => !previousSCPs.physicalIds.includes(x))) {
            const attachSCPTask: IBuildTask = this.createAttachSCPTask(resource, currentSCPS.mapping[attachedSCP], that, () => physicalId, IS_COMMERCIAL);
            tasks.push(attachSCPTask);
        }
        for (const attachedSCP of currentSCPS.unresolvedResources) {
            const attachSCPTask: IBuildTask = this.createAttachSCPTask(resource, { TemplateResource: attachedSCP as ServiceControlPolicyResource }, that, () => physicalId, IS_COMMERCIAL);
            tasks.push(attachSCPTask);
        }
        if (mirror) {
            for (const detachedSCP of previousSCPs.partitionIds.filter(x => !currentSCPS.partitionIds.includes(x))) {
                const detachSCPTask: IBuildTask = this.createDetachSCPTask(resource, previousSCPs.mapping[detachedSCP], that, () => partitionId, IS_PARTITION);
                tasks.push(detachSCPTask);
            }
            for (const attachedSCP of currentSCPS.partitionIds.filter(x => !previousSCPs.partitionIds.includes(x))) {
                const attachSCPTask: IBuildTask = this.createAttachSCPTask(resource, currentSCPS.mapping[attachedSCP], that, () => partitionId, IS_PARTITION);
                tasks.push(attachSCPTask);
            }
            for (const attachedSCP of currentSCPS.unresolvedResources) {
                const attachSCPTask: IBuildTask = this.createAttachSCPTask(resource, { TemplateResource: attachedSCP as ServiceControlPolicyResource }, that, () => partitionId, IS_PARTITION);
                tasks.push(attachSCPTask);
            }
        }

        const createAccountCommitHashTask: IBuildTask = {
            type: resource.type,
            logicalId: resource.logicalId,
            action:  'CommitHash',
            dependentTasks: tasks,
            perform: async (): Promise<void> => {
                if (resource.type === OrgResourceTypes.MasterAccount) {
                    that.state.setUniqueBindingForType({
                        type: resource.type,
                        logicalId: resource.logicalId,
                        lastCommittedHash: hash,
                        physicalId,
                        partitionId,
                    });
                } else {
                    that.state.setBinding({
                        type: resource.type,
                        logicalId: resource.logicalId,
                        lastCommittedHash: hash,
                        physicalId,
                        partitionId,
                    });
                }
            },
        };

        return [...tasks, createAccountCommitHashTask];
    }

    public createAccountCreateTasks(resource: AccountResource, hash: string, mirror: boolean): IBuildTask[] {
        const that = this;
        const tasks: IBuildTask[] = [];
        const createAccountTask: IBuildTask = {
            type: resource.type,
            logicalId: resource.logicalId,
            action:  'Create',
            perform: async (task): Promise<void> => {
                task.result = (mirror) ? await that.writer.createPartitionAccount(resource) : await that.writer.createAccount(resource);
            },
        };
        tasks.push(createAccountTask);

        for (const attachedSCP of resource.serviceControlPolicies) {
            const attachSCPTask: IBuildTask = this.createAttachSCPTask(resource, attachedSCP, that, () => createAccountTask.result.PhysicalId, IS_COMMERCIAL);
            attachSCPTask.dependentTasks = [createAccountTask];
            tasks.push(attachSCPTask);
            if (mirror) {
                const attachPartitionSCPTask: IBuildTask = this.createAttachSCPTask(resource, attachedSCP, that, () => createAccountTask.result.PartitionId, IS_PARTITION);
                attachPartitionSCPTask.dependentTasks = [createAccountTask];
                tasks.push(attachPartitionSCPTask);
            }
        }
        const createAccountCommitHashTask: IBuildTask = {
            type: resource.type,
            logicalId: resource.logicalId,
            action:  'CommitHash',
            dependentTasks: tasks,
            perform: async (): Promise<void> => {
                if (resource.type === OrgResourceTypes.MasterAccount) {
                    that.state.setUniqueBindingForType({
                        type: resource.type,
                        logicalId: resource.logicalId,
                        lastCommittedHash: hash,
                        physicalId: createAccountTask.result.PhysicalId,
                        partitionId: createAccountTask.result.PartitionId,
                    });
                } else {
                    that.state.setBinding({
                        type: resource.type,
                        logicalId: resource.logicalId,
                        lastCommittedHash: hash,
                        physicalId: createAccountTask.result.PhysicalId,
                        partitionId: createAccountTask.result.PartitionId,
                    });
                }
            },
        };
        return [...tasks, createAccountCommitHashTask];
    }

    public createForgetResourceTasks(binding: IBinding): IBuildTask[] {
        return [{
            type: binding.type,
            logicalId: binding.logicalId,
            action: 'Forget',
            perform: async (): Promise<void> => {
                this.state.removeBinding(binding);
            },
        }];
    }

    private createDetachSCPTask(resource: OrganizationalUnitResource | AccountResource | OrganizationRootResource, policy: Reference<ServiceControlPolicyResource>, that: this, getTargetId: () => string, isPartition?: boolean): IBuildTask {
        const writer = (isPartition) ? that.partitionWriter : that.writer;
        let policyId = (isPartition) ? policy.PartitionId : policy.PhysicalId;
        return {
            type: resource.type,
            logicalId: resource.logicalId,
            action: `Detach Policy (${(policy.TemplateResource) ? policy.TemplateResource.logicalId : policyId})`,
            perform: async (task): Promise<void> => {
                if (policyId === undefined) {
                    const binding = that.state.getBinding(OrgResourceTypes.ServiceControlPolicy, policy.TemplateResource.logicalId);
                    policyId = (isPartition) ? binding.partitionId : binding.physicalId;
                }
                const targetId = getTargetId();
                task.result = await writer.detachPolicy(targetId, policyId);
            },
        };
    }

    private createAttachSCPTask(resource: Resource, policy: Reference<ServiceControlPolicyResource>, that: this, getTargetId: () => string, isPartition?: boolean): IBuildTask {
        const writer = (isPartition) ? that.partitionWriter : that.writer;
        let policyId = (isPartition) ? policy.PartitionId : policy.PhysicalId;
        const attachSCPTask: IBuildTask = {
            type: resource.type,
            logicalId: resource.logicalId,
            action: `Attach Policy (${(policy.TemplateResource) ? policy.TemplateResource.logicalId : policyId})`,
            perform: async (task): Promise<void> => {
                if (policyId === undefined) {
                    const binding = that.state.getBinding(OrgResourceTypes.ServiceControlPolicy, policy.TemplateResource.logicalId);
                    policyId = (isPartition) ? binding.partitionId : binding.physicalId;
                }
                const targetId = getTargetId();
                task.result = await writer.attachPolicy(isPartition, targetId, policyId);
            },
        };
        if (policy.TemplateResource && undefined === that.state.getBinding(OrgResourceTypes.ServiceControlPolicy, policy.TemplateResource.logicalId)) {
            attachSCPTask.dependentTaskFilter = (task): boolean => {
                return (task.logicalId === policy.TemplateResource.logicalId && task.action === 'Create' && task.type === OrgResourceTypes.ServiceControlPolicy)
                || (task.action.indexOf('Detach Policy') >= 0);
            };
        }
        return attachSCPTask;
    }

    private createDetachAccountTask(resource: OrganizationalUnitResource, account: Reference<AccountResource>, that: this, getTargetId: () => string, isPartition?: boolean): IBuildTask {
        const writer = (isPartition) ? that.partitionWriter : that.writer;
        let accountId = (isPartition) ? account.PartitionId : account.PhysicalId;
        const detachAccountTask: IBuildTask = {
            type: resource.type,
            logicalId: resource.logicalId,
            action: `Detach Account (${(account.TemplateResource) ? account.TemplateResource.logicalId : accountId})`,
            perform: async (task): Promise<void> => {
                if (accountId === undefined) {
                    const binding = that.state.getBinding(account.TemplateResource.type, account.TemplateResource.logicalId);
                    accountId = (isPartition) ? binding.partitionId : binding.physicalId;
                }
                const targetId = getTargetId();
                task.result = await writer.detachAccount(targetId, accountId);
            },
        };
        if (account.TemplateResource && undefined === that.state.getBinding(account.TemplateResource.type, account.TemplateResource.logicalId)) {
            detachAccountTask.dependentTaskFilter = (task): boolean => task.logicalId === account.TemplateResource.logicalId &&
                task.action === 'Create' &&
                task.type === account.TemplateResource.type;
        }
        return detachAccountTask;
    }

    private createAttachAccountTask(resource: OrganizationalUnitResource, account: Reference<AccountResource>, that: this, getTargetId: () => string, isPartition?: boolean): IBuildTask {
        const writer = (isPartition) ? that.partitionWriter : that.writer;
        let accountId = (isPartition) ? account.PartitionId : account.PhysicalId;
        const attachAccountTask: IBuildTask = {
            type: resource.type,
            logicalId: resource.logicalId,
            action: `Attach Account (${(account.TemplateResource) ? account.TemplateResource.logicalId : accountId})`,
            perform: async (task): Promise<void> => {
                if (accountId === undefined) {
                    const binding = that.state.getBinding(account.TemplateResource.type, account.TemplateResource.logicalId);
                    accountId = (isPartition) ? binding.partitionId : binding.physicalId;
                }
                const targetId = getTargetId();
                task.result = await writer.attachAccount(targetId, accountId);
            },
        };
        if (account.TemplateResource && undefined === that.state.getBinding(account.TemplateResource.type, account.TemplateResource.logicalId)) {
            attachAccountTask.dependentTaskFilter = (task): boolean => task.logicalId === account.TemplateResource.logicalId &&
                task.action === 'Create' &&
                task.type === account.TemplateResource.type;
        }
        return attachAccountTask;
    }

    private createAttachOrganizationalUnitTask(resource: OrganizationalUnitResource, childOu: Reference<OrganizationalUnitResource>, that: this, getTargetId: () => string, isPartition?: boolean): IBuildTask {
        const writer = (isPartition) ? that.partitionWriter : that.writer;
        const ouId = (isPartition) ? childOu.PartitionId : childOu.PhysicalId;
        const attachChildOuTask: IBuildTask = {
            type: resource.type,
            logicalId: resource.logicalId,
            action: `Attach OU (${(childOu.TemplateResource) ? childOu.TemplateResource.logicalId : ouId})`,
            perform: async (task): Promise<void> => {
                const binding = await that.state.getBinding(OrgResourceTypes.OrganizationalUnit, childOu.TemplateResource.logicalId);
                const childOuId = (isPartition) ? binding.partitionId : binding.physicalId;

                const targetId = getTargetId();
                const physicalIdMap: Record<string, string> = {};
                try {
                    await writer.moveOU(targetId, childOuId, physicalIdMap);
                } finally {

                    TaskProvider.updateStateWithOuPhysicalIds(that.state, physicalIdMap, isPartition);
                }
                task.result = physicalIdMap;
            },
        };
        if (childOu.TemplateResource && undefined === that.state.getBinding(OrgResourceTypes.OrganizationalUnit, childOu.TemplateResource.logicalId)) {
            attachChildOuTask.dependentTaskFilter = (task): boolean => task.logicalId === childOu.TemplateResource.logicalId &&
                (task.action === 'Create'
                || task.action.startsWith('Detach OU')) && task.type === OrgResourceTypes.OrganizationalUnit;
        }
        return attachChildOuTask;
    }

    private resolveIDs<TResource extends Resource>(list: Reference<TResource>[]): IResolvedIDs<TResource> {
        const physicalIdsForServiceControlPolicies = list.filter(x => x.PhysicalId).map(x => x.PhysicalId);
        const partitionIdsForServiceControlPolicies = list.filter(x => x.PartitionId).map(x => x.PartitionId);
        const unresolvedResources: TResource[] = [];
        const mapping: Record<string, Reference<TResource>> = {};
        for (const logicalRef of list.filter(x => x.TemplateResource)) {
            const binding = this.state.getBinding(logicalRef.TemplateResource.type, logicalRef.TemplateResource.logicalId);
            if (binding === undefined) {
                unresolvedResources.push(logicalRef.TemplateResource!);
            } else  {
                physicalIdsForServiceControlPolicies.push(binding.physicalId);
                mapping[binding.physicalId] = { ...logicalRef, PhysicalId: binding.physicalId};
                if (binding.partitionId) {
                    partitionIdsForServiceControlPolicies.push(binding.partitionId);
                    mapping[binding.partitionId] = { ...logicalRef, PartitionId: binding.partitionId};
                }
            }
        }
        return {physicalIds: physicalIdsForServiceControlPolicies.sort(), unresolvedResources,
                mapping, partitionIds: partitionIdsForServiceControlPolicies.sort()};
    }

    public static updateStateWithOuPhysicalIds(state: PersistedState, physicalIdMap: Record<string, string>, isPartition: boolean): void {
        const organizationalUnitBindings = state.enumBindings(OrgResourceTypes.OrganizationalUnit);
        for(const binding of organizationalUnitBindings) {
            const oldId =  (isPartition) ? binding.partitionId : binding.physicalId;
            const newId = (isPartition) ? physicalIdMap[binding.partitionId] : physicalIdMap[binding.physicalId];
            if (newId !== undefined) {
                ConsoleUtil.LogDebug(`mapping ${binding.logicalId} old ou ${oldId} to ${newId}`);
                if (isPartition) {
                    binding.partitionId = newId;
                } else {
                    binding.physicalId = newId;
                }
                state.setBinding(binding);
            }
        }
    }
    public static policiesEqual(left: Reference<PasswordPolicyResource> , right: Reference<PasswordPolicyResource>): boolean {
        const leftNull = !left || !left.TemplateResource;
        const rightNull = !right || !right.TemplateResource;

        if (leftNull && rightNull) {
            return true;
        }
        if (leftNull || rightNull) {
            return false;
        }
        return left.TemplateResource!.calculateHash() === right.TemplateResource!.calculateHash();
    };
}


export interface IResolvedIDs<TResource extends Resource> {
    physicalIds: string[];
    partitionIds?: string[];
    unresolvedResources: TResource[];
    mapping: Record<string, Reference<TResource>>;
}
export interface IBuildTask {
    type: string;
    logicalId: string;
    action: BuildTaskAction;
    result?: any;
    done?: boolean;
    dependentTasks?: IBuildTask[];
    dependentTaskFilter?: (task: IBuildTask) => boolean;
    perform: (task: IBuildTask) => Promise<void>;
}

export type BuildTaskAction = 'Create' | 'Update' | 'Delete' | 'Relate' | 'Forget' | 'CommitHash' | string;
