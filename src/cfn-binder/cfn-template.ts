import md5 = require('md5');
import { OrgFormationError } from '../org-formation-error';
import { AccountResource } from '../parser/model/account-resource';
import { IResourceTarget } from '../parser/model/resources-section';
import { TemplateRoot } from '../parser/parser';
import { ResourceUtil } from '../resource-util';
import { PersistedState } from '../state/persisted-state';
import { ICfnBinding, ICfnCrossAccountDependency } from './cfn-binder';

export class CfnTemplate {

    private resultingTemplate: any;
    private resources: Record<string, any>;
    private outputs: Record<string, ICfnOutput>;
    private parameters: Record<string, ICfnParameter>;
    private resourceIdsForTarget: string[];
    private allResourceIds: string[];

    constructor(target: IResourceTarget, private templateRoot: TemplateRoot, private state: PersistedState) {
        this.resourceIdsForTarget = target.resources.map((x) => x.logicalId);
        this.allResourceIds = this.templateRoot.resourcesSection.resources.map((x) => x.logicalId);

        this.resources = {};
        this.outputs = {};
        this.parameters = {};

        this.resultingTemplate = {
            AWSTemplateFormatVersion: '2010-09-09',
            Description: this.templateRoot.contents.Description,
            Parameters: this.parameters,
            Metadata: this.templateRoot.contents.Metadata,
            Resources: this.resources,
            Mappings: this.templateRoot.contents.Mappings,
            Conditions: this.templateRoot.contents.Conditions,
            Outputs: this.outputs,
        };

        const accountResource = this.templateRoot.organizationSection.findAccount((x) => x.logicalId === target.accountLogicalId);

        for (const resource of target.resources) {
            const clonedResource = JSON.parse(JSON.stringify(resource.resourceForTemplate));
            ResourceUtil.FixVersions(clonedResource);
            this._removeCrossAccountDependsOn(clonedResource, this.resourceIdsForTarget, this.allResourceIds);
            if (resource.normalizedForeachAccounts) {
                for (const accountName of resource.normalizedForeachAccounts) {
                    const resourceForAccount = JSON.parse(JSON.stringify(resource.resourceForTemplate));
                    const keywordReplaced = this._replaceKeyword(resourceForAccount, 'CurrentAccount', accountName);
                    this.resources[resource.logicalId + accountName] = this._resolveOrganizationFunctions(keywordReplaced, accountResource);
                }
            } else {
                this.resources[resource.logicalId] = this._resolveOrganizationFunctions(clonedResource, accountResource);
            }
        }

        for (const outputName in this.templateRoot.contents.Outputs) {
            const output = this.templateRoot.contents.Outputs[outputName];
            if (!this._containsRefToOtherTarget(output, this.resourceIdsForTarget, this.allResourceIds)) {
                const clonedOutput = JSON.parse(JSON.stringify(output));
                this.outputs[outputName] = this._resolveOrganizationFunctions(clonedOutput, accountResource);
            }
        }

        for (const paramName in this.templateRoot.contents.Parameters) {
            const param = this.templateRoot.contents.Parameters[paramName];
            this.parameters[paramName] = param;
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

    public addOutput(dependency: ICfnCrossAccountDependency) {
        const cfnFriendlyName = dependency.outputName.replace(/-/g, 'Dash');

        if (!this.outputs[cfnFriendlyName]) {
            this.outputs[cfnFriendlyName] =  {
                Value: dependency.valueExpression,
                Description: 'Cross Account dependency',
                Export: {
                    Name: dependency.outputName,
                },
            };
        }
    }

    public addParameter(dependency: ICfnCrossAccountDependency) {
        if (!this.parameters[dependency.parameterName]) {
            this.parameters[dependency.parameterName] =  {
                Description: 'Cross Account dependency',
                Type: dependency.parameterType,
                ExportAccountId: dependency.outputAccountId,
                ExportRegion: dependency.outputRegion,
                ExportName: dependency.outputName,
            };
        }
    }

    public enumBoundParameters(): ICfnParameter[] {
        const parameters: ICfnParameter[] = [];
        for (const paramName in this.parameters) {
            const parameter = this.parameters[paramName];
            if (parameter.ExportName) {
                parameters.push(parameter);
             }
        }
        return parameters;
    }

    public createTemplateBody(): string {
        return JSON.stringify(this.resultingTemplate, null, 2);
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

    private _containsRefToOtherTarget(resource: any, resourceIdsForTarget: string[], allResourceIds: string[]) {
        if (resource !== null && typeof resource === 'object') {

            const entries = Object.entries(resource);
            if (entries.length === 1) {
                const [key, val]: [string, unknown] = entries[0];
                if (key === 'Ref') {
                    const resourceId = '' + val;
                    if (allResourceIds.includes(resourceId) && !resourceIdsForTarget.includes(resourceId)) {
                        return true;
                    }
                } else if (key === 'Fn::GetAtt') {
                    if (Array.isArray(val)) {
                        const resourceId: string = val[0];
                        if (allResourceIds.includes(resourceId) && !resourceIdsForTarget.includes(resourceId)) {
                            return true;
                        }
                    }
                }
            }
            for (const [key, val] of entries) {
                if (val !== null && typeof val === 'object') {
                    if (this._containsRefToOtherTarget(val, resourceIdsForTarget, allResourceIds)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private _listDependencies(resource: any, binding: ICfnBinding, others: ICfnBinding[], parent: any, parentKey: string): ICfnCrossAccountDependency[] {
        const result: ICfnCrossAccountDependency[] = [];
        if (resource !== null && typeof resource === 'object') {
            const entries = Object.entries(resource);
            if (entries.length === 1) {
                const [key, val]: [string, unknown] = entries[0];
                if (key === 'Ref') {
                    const resourceId: string = '' + val;
                    if (!this.resources[resourceId]) {
                        const foundAccounts = others.filter((o) => undefined !== o.template.resources[resourceId]);
                        if (foundAccounts.length > 1) {
                            throw new Error(`expression ${key}: ${val} matches resources in multiple accounts.`);
                        }
                        if (foundAccounts.length === 1) {
                            const other = foundAccounts[0];
                            const dependency = {
                                outputAccountId: other.accountId,
                                outputRegion: other.region,
                                outputStackName: other.stackName,
                                parameterAccountId: binding.accountId,
                                parameterRegion: binding.region,
                                parameterStackName: binding.stackName,
                                parameterType: 'String',
                                valueExpression: { Ref: val },
                                parameterName: `${val}`,
                                outputName: `${other.stackName}-${val}`,
                            };
                            result.push(dependency);
                            parent[parentKey] = { Ref : dependency.parameterName};
                        }
                    }
                } else if (key === 'Fn::GetAtt') {
                    if (Array.isArray(val)) {
                        const resourceId: string = val[0];
                        const path: string = val[1];
                        if (!this.resources[resourceId]) {
                            const foundAccounts = others.filter((o) => undefined !== o.template.resources[resourceId]);
                            if (foundAccounts.length > 1) {
                                throw new Error(`expression ${key}: ${val.join('.')} matches resources in multiple accounts.`);
                            }
                            // todo: add error for more than 1 target
                            if (foundAccounts.length === 1) {
                                const other = foundAccounts[0];
                                let parameterType = 'String';
                                let valueExpression: any = { 'Fn::GetAtt': [resourceId, path] };
                                if (path.endsWith('NameServers')) { // todo: add more comma delimeted list attribute names that can be used in GetAtt
                                    parameterType = 'CommaDelimitedList';
                                    valueExpression = {'Fn::Join' : [', ', { 'Fn::GetAtt': [resourceId, path] }]};
                                }

                                const dependency = {
                                    outputAccountId: other.accountId,
                                    outputRegion: other.region,
                                    outputStackName: other.stackName,
                                    parameterAccountId: binding.accountId,
                                    parameterRegion: binding.region,
                                    parameterStackName: binding.stackName,
                                    parameterType,
                                    valueExpression,
                                    parameterName: `${resourceId}Dot${path.replace(/\./g, 'Dot')}`,
                                    outputName: `${other.stackName}-${resourceId}-${path.replace(/\./g, 'Dot')}`,
                                };
                                result.push(dependency);
                                parent[parentKey] = { Ref : dependency.parameterName};
                            }
                        }
                        const account = this.templateRoot.organizationSection.accounts.find((x) => x.logicalId === resourceId);
                        if (account) {
                            const accountBinding = this.state.getBinding(account.type, resourceId);
                            const other = others.find((o) => accountBinding.physicalId === o.accountId);
                            if (path.startsWith('Resources.')) {
                                const pathParts = path.split('.');
                                const remoteResourceId = pathParts[1];
                                let remotePath = pathParts[2];
                                for (let i  = 3; i < pathParts.length; i++) {
                                    remotePath += '.' + pathParts[i];
                                }
                                let parameterType = 'String';
                                let valueExpression: any = { 'Fn::GetAtt': [remoteResourceId, remotePath] };
                                if (remotePath.endsWith('NameServers')) { // todo: add more comma delimeted list attribute names that can be used in GetAtt
                                    parameterType = 'CommaDelimitedList';
                                    valueExpression = {'Fn::Join' : [', ', { 'Fn::GetAtt': [remoteResourceId, remotePath] }]};
                                }

                                const dependency = {
                                    outputAccountId: other.accountId,
                                    outputRegion: other.region,
                                    outputStackName: other.stackName,
                                    parameterAccountId: binding.accountId,
                                    parameterRegion: binding.region,
                                    parameterStackName: binding.stackName,
                                    parameterType,
                                    valueExpression,
                                    parameterName: `${resourceId}Dot${path.replace(/\./g, 'Dot')}`,
                                    outputName: `${other.stackName}-${resourceId}-${path.replace(/\./g, 'Dot')}`,
                                };
                                result.push(dependency);
                                parent[parentKey] = { Ref : dependency.parameterName};
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

    private _replaceKeyword(resource: any, keyword: string, replacement: string) {
        if (resource !== null && typeof resource === 'object') {
            const entries = Object.entries(resource);
            if (entries.length === 1) {
                const [key, val]: [string, unknown] = entries[0];
                if (key === 'Ref' && val === keyword) {
                    return {Ref : replacement};
                } else if (key === 'Fn::GetAtt') {
                    if (Array.isArray(val) && val.length === 2) {
                        if (val[0] === keyword) {
                            return {'Fn::GetAtt' : [replacement, val[1]]};
                        }
                    }
                } else if (key === 'Fn::Sub') {
                    if (typeof val === 'string') {
                        let result = val;
                        const matches = val.match(/\${([\w\.]*)}/g);
                        if (!matches) {
                            return { 'Fn::Sub': result };
                        }
                        for (const match of matches) {
                            const expresion = match.substr(2, match.length - 3); // ${xxx}
                            if (!expresion.includes('.')) {
                                if (expresion === keyword) {
                                    result = result.replace(match, '${' + replacement + '}');
                                }
                            } else {
                                const firstIndexOfDot = expresion.indexOf('.');
                                const logicalId = expresion.substr(0, firstIndexOfDot);
                                const path = expresion.substr(firstIndexOfDot + 1);
                                if (logicalId === keyword) {
                                    result = result.replace(match, '${' + replacement + '.' + path + '}');
                                }
                            }
                        }

                        if (result.includes('$')) {
                            return {'Fn::Sub': result};
                        }
                        return result;
                    }
                }
            }
            for (const [key, val] of entries) {
                if (val !== null && typeof val === 'object') {
                    resource[key] = this._replaceKeyword(val, keyword, replacement);
                }
            }

        }
        return resource;

    }

    private _resolveOrganizationFunctions(resource: any, accountResource: AccountResource): any {
        if (resource !== null && typeof resource === 'object') {
            const entries = Object.entries(resource);
            if (entries.length === 1) {
                const [key, val]: [string, unknown] = entries[0];
                if (key === 'Ref') {
                    const physicalId = this.getOrgResourceRef(val);
                    if (physicalId) {
                        return physicalId;
                    }
                } else if (key === 'Fn::GetAtt') {
                    if (Array.isArray(val) && val.length === 2) {
                        const att = this.getOrgResourceAtt(val[0], val[1], accountResource);
                        if (att) {
                            return att;
                        }
                    }
                } else if (key === 'Fn::Sub') {
                    if (typeof val === 'string') {
                        let result = val;
                        const matches = val.match(/\${([\w\.]*)}/g);
                        if (!matches) {
                            return { 'Fn::Sub': result };
                        }
                        for (const match of matches) {
                            const expresion = match.substr(2, match.length - 3); // ${xxx}
                            if (!expresion.includes('.')) {
                                const physicalId = this.getOrgResourceRef(expresion);
                                if (physicalId) {
                                    result = result.replace(match, physicalId);
                                }
                            } else {
                                const firstIndexOfDot = expresion.indexOf('.');
                                const logicalId = expresion.substr(0, firstIndexOfDot);
                                const path = expresion.substr(firstIndexOfDot + 1);
                                const att = this.getOrgResourceAtt(logicalId, path, accountResource);
                                if (att) {
                                    result = result.replace(match, att);
                                }
                            }
                        }

                        if (result.includes('$')) {
                            return {'Fn::Sub': result};
                        }
                        return result;
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

    private getOrgResourceRef(logicalId: any): string {
        const orgResource = this.templateRoot.organizationSection.resources.find((x) => x.logicalId === logicalId);
        if (orgResource) {
            const binding = this.state.getBinding(orgResource.type, orgResource.logicalId);
            return binding.physicalId;
        }
        return undefined;
    }

    private getOrgResourceAtt(logicalId: string, path: string, accountResource: AccountResource): string {
        let account = this.templateRoot.organizationSection.findAccount((x) => x.logicalId === logicalId);
        if (!account && logicalId === 'AWSAccount') {
            account = accountResource;
        }
        if (account) {
            if (path.indexOf('Tags.') === 0) {
                const tagName = path.substr(5); // Tags.
                if (!account.tags) {
                    return '';
                }
                const tagValue = account.tags[tagName];
                if (!tagValue) { return ''; }
                return tagValue;
            } else if (path === 'AccountName') {
                return account.accountName;
            } else if (path === 'Alias') {
                return account.alias;
            } else if (path === 'AccountId') {
                const binding = this.state.getBinding(account.type, account.logicalId);
                return binding.physicalId;
            } else if (path === 'RootEmail') {
                return account.rootEmail;
            }
        }

        return undefined;
    }
}

export interface ICfnParameter {
    Description: string;
    Type: string;
    Default?: string;
    ExportName?: string;
    ExportAccountId?: string;
    ExportRegion?: string;
}
export interface ICfnExport {
    Name: string;
}
export interface ICfnOutput {
    Export: ICfnExport;
    Value: string;
    Description: string;
}
