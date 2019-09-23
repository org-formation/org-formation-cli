import { OrgFormationError } from '../org-formation-error';
import { AccountResource } from '../parser/model/account-resource';
import { ICrossAccountResourceDependencies, IResourceTarget } from '../parser/model/resources-section';
import { TemplateRoot } from '../parser/parser';
import { PersistedState } from '../state/persisted-state';

export class CfnTransform {
    private template: TemplateRoot;
    private state: PersistedState;

    constructor(template: TemplateRoot, state: PersistedState) {
        this.template = template;
        this.state = state;
    }

    public createTemplateForBinding(target: IResourceTarget): any {
        const resources: Record<string, any> = {};
        const resultingTemplate = {
            AWSTemplateFormatVersion: '2010-09-09',
            Description: this.template.contents.Description,
            Parameters: this.template.contents.Parameters,
            Metadata: this.template.contents.Metadata,
            Resources: resources,
            Mappings: this.template.contents.Mappings,
            Conditions: this.template.contents.Conditions,
            Outputs: this.template.contents.Outputs,
        };

        const accountResource = this.template.organizationSection.findAccount((x) => x.logicalId === target.accountLogicalId);
        const allResourceIds = this.template.resourcesSection.resources.map((x) => x.logicalId);
        const resourceIdsForTarget = target.resources.map((x) => x.logicalId);

        for (const resource of target.resources) {
            const clonedResource = JSON.parse(JSON.stringify(resource.resourceForTemplate));
            const resourceForTemplate = this.resolveOrganizationFunctions(clonedResource, target, accountResource);
            this.removeCrossAccountDependsOn(resourceForTemplate, allResourceIds, resourceIdsForTarget);
            resources[resource.logicalId] = resourceForTemplate;
        }

        for (const prop in resultingTemplate) {
            if (!resultingTemplate[prop]) {
                delete resultingTemplate[prop];
            }
        }
        return resultingTemplate;
    }

    private removeCrossAccountDependsOn(resource: any, allResourceIds: string[], resourceIdsForTarget: string[]) {
        if (resource !== null && typeof resource === 'object') {
            if (resource.DependsOn !== null && Array.isArray(resource.DependsOn)) {
                const dependsOn = resource.DependsOn as string[];
                const unresolvedDependency = dependsOn.find((x) => !allResourceIds.includes(x));
                if (unresolvedDependency) {
                    throw new OrgFormationError(`Dependent resource ${unresolvedDependency} could not be resolved`);
                }

                resource.DependsOn = dependsOn.filter((x) => resourceIdsForTarget.includes(x));
            }
        }
    }

    private resolveOrganizationFunctions(resource: any, resourceTarget: IResourceTarget, accountResource: AccountResource): any {
        if (resource !== null && typeof resource === 'object') {
            const entries = Object.entries(resource);
            if (entries.length === 1) {
                const [key, val]: [string, unknown] = entries[0];
                if (key === 'Ref') {
                    const orgResource = this.template.organizationSection.resources.find((x) => x.logicalId === val);
                    if (orgResource) {
                        const binding = this.state.getBinding(orgResource.type, orgResource.logicalId);
                        return binding.physicalId;
                    } else if (-1 === resourceTarget.resources.findIndex((x) => x.logicalId === val)) {
                        const targetResource = this.template.resourcesSection.resources.find((x) => x.logicalId === val);
                        const targetAccounts = targetResource.getNormalizedBoundAccounts();
                        if (targetAccounts.length === 0) {
                            throw new OrgFormationError(`reference to resource ${targetResource} does not resolve to any account`);
                        } else if (targetAccounts.length !== 1) {
                            throw new OrgFormationError(`reference to resource ${targetResource} resolves to more than 1 account`);
                        }
                        if (!resourceTarget.dependencies) {
                            resourceTarget.dependencies = [];
                        }
                        const dependency = {
                            Account : targetAccounts[0],
                            Ref: val,
                        } as ICrossAccountResourceDependencies;
                        resourceTarget.dependencies.push(dependency);
                        return dependency;
                    }
                } else if (key === 'Fn::GetAtt') {
                    if (Array.isArray(val)) {
                        if (val && val.length === 2 && val[0] === 'AWSAccount') {
                            if (val[1].indexOf('Tags.') === 0) {
                                const tagName = val[1].substr(5); // Tags.
                                if (!accountResource.tags) {
                                    return '';
                                }
                                const tagValue = accountResource.tags[tagName];
                                if (!tagValue) { return ''; }
                                return tagValue;
                            } else if (val[1] === 'AccountName') {
                                return accountResource.accountName;
                            } else if (val[1] === 'AccountId') {
                                return accountResource.accountId;
                            } else if (val[1] === 'RootEmail') {
                                return accountResource.rootEmail;
                            }
                        }
                     }
                }
            }
            for (const [key, val] of entries) {
                if (val !== null && typeof val === 'object') {
                    resource[key] = this.resolveOrganizationFunctions(val, resourceTarget, accountResource);
                }
            }

        }
        return resource;
    }
}
