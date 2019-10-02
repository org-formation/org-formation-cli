import md5 = require('md5');
import { OrgFormationError } from '../org-formation-error';
import { AccountResource } from '../parser/model/account-resource';
import { ICrossAccountResourceDependencies, IResourceTarget } from '../parser/model/resources-section';
import { TemplateRoot } from '../parser/parser';
import { PersistedState } from '../state/persisted-state';
import { ICfnBinding, ICfnCrossAccountDependency } from './cfn-binder';
import { ResourceUtil } from '../resource-util';

export class CfnTemplate {

    private resultingTemplate: any;
    private resources: Record<string, any>;
    private resourceIdsForTarget: string[];

    constructor(private target: IResourceTarget, private templateRoot: TemplateRoot, private state: PersistedState) {
        this.resourceIdsForTarget = target.resources.map((x) => x.logicalId);
        this.resources = {};
        this.resultingTemplate = {
            AWSTemplateFormatVersion: '2010-09-09',
            Description: this.templateRoot.contents.Description,
            Parameters: this.templateRoot.contents.Parameters,
            Metadata: this.templateRoot.contents.Metadata,
            Resources: this.resources,
            Mappings: this.templateRoot.contents.Mappings,
            Conditions: this.templateRoot.contents.Conditions,
            Outputs: this.templateRoot.contents.Outputs,
        };

        for (const resource of target.resources) {
            const clonedResource = JSON.parse(JSON.stringify(resource.resourceForTemplate));
            ResourceUtil.FixVersions(clonedResource);
            this.resources[resource.logicalId] = clonedResource;
        }

        for (const prop in this.resultingTemplate) {
            if (!this.resultingTemplate[prop]) {
                delete this.resultingTemplate[prop];
            }
        }
    }

    public listDependencies(binding: ICfnBinding, others: ICfnBinding[]): ICfnCrossAccountDependency[] {
        const result: ICfnCrossAccountDependency[] = [];
        for (const logicalId in this.resources) {
            const resource = this.resources[logicalId];
            const foundDependencies = this._listDependencies(resource, binding, others, null, null);
            if (foundDependencies.length > 0) {
                result.push(...foundDependencies);
            }
        }
        return result;
    }

    public addOutputs(outputs: any) {
        if (this.resultingTemplate.Outputs) {
            this.resultingTemplate.Outputs = { ...this.resultingTemplate.Outputs, outputs };
        } else {
            this.resultingTemplate.Outputs = outputs;
        }
    }

    public createTemplateBody(): string {
        return JSON.stringify(this.resultingTemplate, null, 2);
    }

    public resolveOrganizationFunctions(accountResource: AccountResource) {
        const allResourceIds = this.templateRoot.resourcesSection.resources.map((x) => x.logicalId);
        for (const logicalId in this.resources) {
            const resource = this.resources[logicalId];
            this._removeCrossAccountDependsOn(resource, this.resourceIdsForTarget, allResourceIds);
            this.resources[logicalId] = this._resolveOrganizationFunctions(resource, accountResource);
        }
    }

    private _removeCrossAccountDependsOn(resource: any, resourceIdsForTarget: string[], allResourceIds: string[]) {
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

    private _listDependencies(resource: any, binding: ICfnBinding, others: ICfnBinding[], parent: any, parentKey: string): ICfnCrossAccountDependency[] {
        const result: ICfnCrossAccountDependency[] = [];
        if (resource !== null && typeof resource === 'object') {
            const entries = Object.entries(resource);
            if (entries.length === 1) {
                const [key, val]: [string, unknown] = entries[0];
                if (key === 'Ref') {
                    if (!this.resources['' + val]) {
                        const other = others.find((x) => x.region === this.target.region && undefined !== x.target.resources.find((x) => x.logicalId === val));
                        if (other) {
                            result.push({
                                dependencyAccountId: other.accountId,
                                dependencyRegion: other.region,
                                dependencyStackName: other.stackName,
                                dependentAccountId: binding.accountId,
                                dependentRegion: binding.region,
                                dependentStackName: binding.stackName,
                                valueExpression: { Ref: val },
                                outputName: `${binding.stackName}-${val}`,
                                resolve: (x) => { parent[parentKey] = x; },
                            });
                        }
                    }
                } else if (key === 'Fn::GetAtt') {
                    if (Array.isArray(val)) {
                        const resourceId: string = val[0];
                        const path: string = val[1];
                        if (!this.resources[resourceId]) {
                            const other = others.find((x) => x.region === this.target.region && undefined !== x.target.resources.find((x) => x.logicalId === resourceId));
                            if (other) {
                                result.push({
                                    dependencyAccountId: other.accountId,
                                    dependencyRegion: other.region,
                                    dependencyStackName: other.stackName,
                                    dependentAccountId: binding.accountId,
                                    dependentRegion: binding.region,
                                    dependentStackName: binding.stackName,
                                    valueExpression: { GetAtt: [resourceId, path] },
                                    outputName: `${binding.stackName}-${resourceId}-${path}`,
                                    resolve: (x) => { parent[parentKey] = x; },
                                });
                            }
                        }
                    }
                }
            }
            for (const [key, val] of entries) {
                if (val !== null && typeof val === 'object') {
                    result.push(...this._listDependencies(val, binding, others, resource, key));
                }
            }

        }
        return result;
    }

    private _resolveOrganizationFunctions(resource: any, accountResource: AccountResource): any {
        if (resource !== null && typeof resource === 'object') {
            const entries = Object.entries(resource);
            if (entries.length === 1) {
                const [key, val]: [string, unknown] = entries[0];
                if (key === 'Ref') {
                    const orgResource = this.templateRoot.organizationSection.resources.find((x) => x.logicalId === val);
                    if (orgResource) {
                        const binding = this.state.getBinding(orgResource.type, orgResource.logicalId);
                        return binding.physicalId;
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
                    resource[key] = this._resolveOrganizationFunctions(val, accountResource);
                }
            }

        }
        return resource;
    }
}
