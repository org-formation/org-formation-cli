import Organizations = require('aws-sdk/clients/organizations');
import { ConsoleUtil } from '../console-util';
import { OrgFormationError } from '../org-formation-error';
import { AccountResource } from '../parser/model/account-resource';
import { IResourceTarget } from '../parser/model/resources-section';
import { TemplateRoot } from '../parser/parser';
import { ResourceUtil } from '../resource-util';
import { PersistedState } from '../state/persisted-state';
import { ICfnBinding, ICfnCrossAccountDependency, ICfnSubValue, ICfnValue } from './cfn-binder';

export class CfnTemplate {

    private static ResolveBindingForResourceSpecificAccount(bindings: ICfnBinding[], physicalAccountId: string, resourceLogicalId: string, accountLogicalId: string): ICfnBinding {
        const foundBinding = bindings.
            filter((x) => x.accountId === physicalAccountId).
            filter((x) => x.template!.resources[resourceLogicalId]);

        if (foundBinding.length === 0) {
            ConsoleUtil.LogWarning(`Unable to find resource ${resourceLogicalId} on account ${accountLogicalId}`);
            return undefined;
        }
        if (foundBinding.length > 1) {
            const list = foundBinding.map((x) => `${x.accountId}/${x.region}`).join(', ');
            throw new OrgFormationError(`Found multiple targets for reference to ${accountLogicalId} ${resourceLogicalId}. e.g: ${list}`);
        }
        return foundBinding[0];
    }

    private static ResolveBindingForResource(bindings: ICfnBinding[], resourceLogicalId: string): ICfnBinding {
        const foundBinding = bindings.filter((x) => x.template!.resources[resourceLogicalId]);
        if (foundBinding.length === 0) {
            ConsoleUtil.LogDebug(`Unable to find resource with logicalId ${resourceLogicalId}.`);
            return undefined;
        }
        if (foundBinding.length > 1) {
            const list = foundBinding.map((x) => `${x.accountId}/${x.region}`).join(', ');
            throw new OrgFormationError(`Found multiple targets for reference to ${resourceLogicalId}. e.g: ${list}`);
        }
        return foundBinding[0];
    }

    private static CreateCrossAccountReferenceForRef(target: ICfnBinding, resourceLogicalId: string): ICfnCrossAccountReference {
        return {
            accountId: target.accountId,
            stackName: target.stackName,
            region: target.region,
            referenceType: 'Ref',
            resourceLogicalId,
            valueType: 'String',
            path: undefined,
            uniqueNameForExport: `${target.stackName}-${resourceLogicalId}`,
            expressionForExport: { Ref: resourceLogicalId },
            uniqueNameForImport: resourceLogicalId,
        };
    }

    private static CreateCrossAccountReferenceForGetAtt(target: ICfnBinding, resourceLogicalId: string, path: string, accountLogicalId?: string): ICfnCrossAccountReference {
        const result: ICfnCrossAccountReference = {
            accountId: target.accountId,
            stackName: target.stackName,
            region: target.region,
            referenceType: 'GetAtt',
            resourceLogicalId,
            valueType: 'String',
            path,
            uniqueNameForExport: `${target.stackName}-${resourceLogicalId}-${path}`.replace(/\./g, 'Dot'),
            expressionForExport: { 'Fn::GetAtt': [resourceLogicalId, path] },
            uniqueNameForImport: (resourceLogicalId + 'Dot' + path).replace(/\./g, 'Dot'),
        };

        if (accountLogicalId) {
            result.uniqueNameForImport = accountLogicalId + 'DotResourcesDot' + result.uniqueNameForImport;
        }

        if (path && path.endsWith('NameServers')) { // todo: add list of other attributes that are not string;
            result.valueType = 'CommaDelimitedList';
            result.expressionForExport = { 'Fn::Join': [', ', { 'Fn::GetAtt': [resourceLogicalId, path] }] };
        }

        return result;
    }

    private static CreateDependency(source: ICfnBinding, target: ICfnCrossAccountReference) {
        return {
            parameterAccountId: source.accountId,
            parameterRegion: source.region,
            parameterStackName: source.stackName,
            parameterType: target.valueType,
            parameterName: target.uniqueNameForImport,
            outputAccountId: target.accountId,
            outputRegion: target.region,
            outputStackName: target.stackName,
            outputName: target.uniqueNameForExport,
            outputValueExpression: target.expressionForExport,
        };
    }

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
            Resources: this.resources,
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
            const clonedParam = JSON.parse(JSON.stringify(param));
            this.parameters[paramName] = this._resolveOrganizationFunctions(clonedParam, accountResource);
        }

        if (this.templateRoot.contents.Metadata) {
            const clonedMetadata = JSON.parse(JSON.stringify(this.templateRoot.contents.Metadata));
            this.resultingTemplate.Metadata = this._resolveOrganizationFunctions(clonedMetadata, accountResource);

        }
        if (this.templateRoot.contents.Conditions) {
            const clonedConditions = JSON.parse(JSON.stringify(this.templateRoot.contents.Conditions));
            this.resultingTemplate.Conditions = this._resolveOrganizationFunctions(clonedConditions, accountResource);
        }

        if (this.templateRoot.contents.Mappings) {
            const clonedMappings = JSON.parse(JSON.stringify(this.templateRoot.contents.Mappings));
            this.resultingTemplate.Mappings = this._resolveOrganizationFunctions(clonedMappings, accountResource);
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
            this.outputs[cfnFriendlyName] = {
                Value: dependency.outputValueExpression,
                Description: 'Cross Account dependency',
                Export: {
                    Name: dependency.outputName,
                },
            };
        }
    }

    public addParameter(dependency: ICfnCrossAccountDependency) {
        if (!this.parameters[dependency.parameterName]) {
            this.parameters[dependency.parameterName] = {
                Description: 'Cross Account dependency',
                Type: dependency.parameterType,
                ExportAccountId: dependency.outputAccountId,
                ExportRegion: dependency.outputRegion,
                ExportName: dependency.outputName,
            };
        }
    }

    public enumBoundParameters(): Record<string, ICfnParameter> {
        const parameters: Record<string, ICfnParameter> = {};
        for (const paramName in this.parameters) {
            const parameter = this.parameters[paramName];
            if (parameter.ExportName) {
                parameters[paramName] = parameter;
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
                if (key === 'Fn::Sub') {
                    const sub = new SubExpression(val as string | any[]);
                    const localKeys: string[] = sub.locals ? Object.keys(sub.locals) : [];

                    for (const variable of sub.variables) {
                        if (localKeys.includes(variable.resource)) { continue; }
                        if (this.resources[variable.resource]) { continue; }
                        if (this.parameters[variable.resource]) { continue; }

                        let target: ICfnBinding | undefined;
                        let resourceId = variable.resource;
                        let path = variable.path;
                        if (variable.path && variable.path.startsWith('Resources')) {
                            const targetAccount = this.templateRoot.organizationSection.findAccount((x) => x.logicalId === resourceId);
                            if (!targetAccount) { throw new OrgFormationError(`unable to find account ${resourceId} for cross account dependency`); }

                            const accountState = this.state.getBinding(targetAccount.type, targetAccount.logicalId);
                            if (!accountState) { throw new OrgFormationError(`unable to find account ${resourceId} in state. Is your organization up to date?`); }

                            const pathParts = variable.path.split('.');
                            const remoteResourceId = pathParts[1];
                            let remotePath = (pathParts.length > 2) ? pathParts[2] : undefined;
                            if (pathParts.length > 3) {
                                for (let i = 3; i < pathParts.length; i++) {
                                    remotePath += '.' + pathParts[i];
                                }
                            }
                            path = remotePath;
                            resourceId = remoteResourceId;
                            target = CfnTemplate.ResolveBindingForResourceSpecificAccount(others, accountState.physicalId, resourceId, targetAccount.logicalId);

                            if (target.accountId === binding.accountId && target.region === binding.region) {
                                // rewrite to local reference, todo: add tests
                                if (remotePath) {
                                    variable.replace('${' + remoteResourceId + '.' + remotePath + '}');
                                } else {
                                    variable.replace('${' + remoteResourceId + '}');
                                }
                                continue;
                            }

                        } else {
                            target = CfnTemplate.ResolveBindingForResource(others, resourceId);
                        }
                        if (!target) { continue; }

                        const reference = path ?
                            CfnTemplate.CreateCrossAccountReferenceForGetAtt(target, resourceId, path) :
                            CfnTemplate.CreateCrossAccountReferenceForRef(target, resourceId);

                        const dependency = CfnTemplate.CreateDependency(binding, reference);

                        result.push(dependency);
                        variable.replace('${' + dependency.parameterName + '}');
                    }

                    parent[parentKey] = { 'Fn::Sub': sub.getSubValue() };

                } else if (key === 'Ref') {
                    const resourceId: string = '' + val;
                    if (!this.resources[resourceId]) {
                        const target = CfnTemplate.ResolveBindingForResource(others, resourceId);
                        if (target) {
                            const reference = CfnTemplate.CreateCrossAccountReferenceForRef(target, resourceId);
                            const dependency = CfnTemplate.CreateDependency(binding, reference);

                            result.push(dependency);
                            parent[parentKey] = { Ref: dependency.parameterName };
                        }
                    }
                } else if (key === 'Fn::GetAtt') {
                    if (Array.isArray(val)) {
                        let resourceId: string = val[0];
                        let path: string = val[1];
                        if (!this.resources[resourceId]) {
                            let processed = false;
                            let target;
                            if (path.startsWith('Resources.')) {
                                const targetAccount = this.templateRoot.organizationSection.findAccount((x) => x.logicalId === resourceId);
                                if (!targetAccount) { throw new OrgFormationError(`unable to find account ${resourceId} for cross account dependency`); }

                                const accountState = this.state.getBinding(targetAccount.type, targetAccount.logicalId);
                                if (!accountState) { throw new OrgFormationError(`unable to find account ${resourceId} in state. Is your organization up to date?`); }

                                const pathParts = path.split('.');
                                const accountLogicalId = resourceId;
                                const remoteResourceId = pathParts[1];
                                let remotePath = (pathParts.length > 2) ? pathParts[2] : undefined;
                                if (pathParts.length > 3) {
                                    for (let i = 3; i < pathParts.length; i++) {
                                        remotePath += '.' + pathParts[i];
                                    }
                                }

                                target = CfnTemplate.ResolveBindingForResourceSpecificAccount(others, accountState.physicalId, remoteResourceId, accountLogicalId);
                                if (target) {
                                    if (target.accountId === binding.accountId && target.region === binding.region) {
                                        // rewrite to local reference, todo: add tests
                                        if (remotePath) {
                                            parent[parentKey] = { 'Fn::GetAtt': [remoteResourceId, remotePath] };
                                        } else {
                                            parent[parentKey] = { Ref: remoteResourceId };
                                        }
                                        processed = true;
                                    }
                                    resourceId = remoteResourceId;
                                    path = remotePath;
                                }
                            } else {
                                target = CfnTemplate.ResolveBindingForResource(others, resourceId);
                            }

                            if (target && !processed) {
                                const reference = path ?
                                    CfnTemplate.CreateCrossAccountReferenceForGetAtt(target, resourceId, path, val[0]) :
                                    CfnTemplate.CreateCrossAccountReferenceForRef(target, resourceId);

                                const dependency = CfnTemplate.CreateDependency(binding, reference);

                                result.push(dependency);
                                parent[parentKey] = { Ref: dependency.parameterName };
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
                    return { Ref: replacement };
                } else if (key === 'Fn::GetAtt') {
                    if (Array.isArray(val) && val.length === 2) {
                        if (val[0] === keyword) {
                            return { 'Fn::GetAtt': [replacement, val[1]] };
                        }
                    }
                } else if (key === 'Fn::Sub') {
                    const sub = new SubExpression(val as string | any[]);
                    const variablesWithKeyword = sub.variables.filter((x) => x.resource === keyword);
                    if (variablesWithKeyword.length === 0) {
                        return { 'Fn::Sub': val };
                    }

                    for (const variableWithKeyword of variablesWithKeyword) {
                        let expressionWithReplacement = replacement;
                        if (variableWithKeyword.path) {
                            expressionWithReplacement = expressionWithReplacement + '.' + variableWithKeyword.path;
                        }
                        expressionWithReplacement = '${' + expressionWithReplacement + '}';
                        variableWithKeyword.replace(expressionWithReplacement);
                    }
                    return { 'Fn::Sub': sub.getSubValue() };

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

    private _resolveOrganizationFunctions(resource: any, accountResource: AccountResource) {
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
                        if (att !== undefined) {
                            return att;
                        }
                    }
                } else if (key === 'Fn::Sub') {
                    const sub = new SubExpression(val as string | any[]);

                    if (!sub.hasVariables()) {
                        return { 'Fn::Sub': sub.getSubValue() };
                    }

                    for (const variable of sub.variables) {
                        if (variable.path) { // GetAtt
                            const resolvedValue = this.getOrgResourceAtt(variable.resource, variable.path, accountResource);
                            if (resolvedValue !== undefined) {
                                variable.replace(resolvedValue);
                            }
                        } else { // Ref
                            const resolvedValue = this.getOrgResourceRef(variable.resource);
                            if (resolvedValue) {
                                variable.replace(resolvedValue);
                            }
                        }
                    }

                    for (const [key, val] of entries) {
                        if (val !== null && typeof val === 'object') {
                            resource[key] = this._resolveOrganizationFunctions(val, accountResource);
                        }
                    }

                    if (sub.hasVariables()) {
                        return { 'Fn::Sub': sub.getSubValue() };
                    }

                    return sub.getSubValue();
                }
            }

            for (const [key, val] of entries) {
                if (val !== null && typeof val === 'object') {
                    resource[key] = this._resolveOrganizationFunctions(val, accountResource);
                }

                if (val !== null && typeof val === 'string') {
                    if (val.startsWith('Fn::EnumTargetAccounts ')) {
                        resource[key] = this.resolveEnumExpression('EnumTargetAccounts', val, accountResource, 'account');
                    } else if (val.startsWith('Fn::EnumTargetRegions')) {
                        resource[key] = this.resolveEnumExpression('EnumTargetRegions', val, accountResource, 'region');
                    }
                }
            }

        }
        return resource;
    }

    private resolveEnumExpression(which: 'EnumTargetAccounts' | 'EnumTargetRegions', val: string, accountResource: AccountResource, replacementParameter: string) {
        const parts = val.split(' ');
        if (parts.length < 2 || parts.length > 3) {
            throw new OrgFormationError(`invalid ${parts[0]} expression ${parts.slice(1)}`);
        }
        const resourceId = parts[1];
        const cfnResource = this.templateRoot.resourcesSection.resources.find((x) => x.logicalId === resourceId);
        if (cfnResource === undefined) {
            throw new OrgFormationError(`unable to find resource ${resourceId} from  ${parts[0]} expression`);
        }
        const enumUnderlyingValues = [];
        if (which === 'EnumTargetAccounts') {
            const normalizedLogicalAccountIds = cfnResource.normalizedBoundAccounts;
            for (const logicalAccountId of normalizedLogicalAccountIds) {

                const physicalId = this.getOrgResourceAtt(logicalAccountId, 'AccountId', accountResource);
                enumUnderlyingValues.push(physicalId);
            }
        } else if (which === 'EnumTargetRegions') {
            enumUnderlyingValues.push(...cfnResource.regions);
        }

        let expression = '${' + replacementParameter + '}';
        if (parts.length === 3) {
            expression = parts[2];
        }
        const converted = this.convertExpression(enumUnderlyingValues, expression, replacementParameter);
        const result: any[] = [];
        for (const element of converted) {
            if (element.hasVariables()) {
                result.push({ 'Fn::Sub': element.getSubValue() });
            } else {
                result.push(element.getSubValue());
            }
        }
        if (result.length === 1) {
            return result[0];
        }
        return result;
    }

    private convertExpression(values: string[], expression: string, resourceId: string): SubExpression[] {
        const result: SubExpression[] = [];
        for (const val of values) {
            const x = new SubExpression(expression);
            const accountVar = x.variables.find((x) => x.resource === resourceId);
            if (accountVar) {
                accountVar.replace(val);
            }
            result.push(x);
        }
        return result;
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
                    throw new OrgFormationError(`unable to resolve account attribute ${logicalId}.${path}. Account has no Tags`);
                }
                const tagValue = account.tags[tagName];
                if (tagValue === undefined) {
                    throw new OrgFormationError(`unable to resolve account attribute ${logicalId}.${path}. Tag ${tagName} not found on account`);
                }
                return tagValue;
            } else if (path === 'AccountName') {
                if (!account.accountName) { return ''; }
                return account.accountName;
            } else if (path === 'Alias') {
                if (!account.alias) { return ''; }
                return account.alias;
            } else if (path === 'AccountId') {
                const binding = this.state.getBinding(account.type, account.logicalId);
                return binding.physicalId;
            } else if (path === 'RootEmail') {
                if (!account.rootEmail) { return ''; }
                return account.rootEmail;
            }
            if (!path.startsWith('Resources')) {
                throw new OrgFormationError(`unable to resolve account attribute ${logicalId}.${path}`);
            }
        }

        return undefined;
    }
}

class SubExpression {

    public variables: ISubExpressionVeriable[];
    public expression: string;
    public locals?: any;
    constructor(subValue: string | any[]) {
        if (!subValue) { throw new OrgFormationError('!Sub Value must not be undefined'); }
        if (typeof subValue === 'string') {
            this.expression = subValue;
        } else if (Array.isArray(subValue)) {
            if (subValue.length === 0) { throw new OrgFormationError('!Sub Value must not be empty array'); }
            if (typeof subValue[0] !== 'string') { throw new OrgFormationError('!Sub first element must be string'); }
            this.expression = subValue[0];
            if (subValue.length > 1) {
                this.locals = subValue[1];
            }
        } else {
            throw new OrgFormationError('unable to parse !Sub expression');
        }

        const matches = this.expression.match(/\${([\w\.]*)}/g);
        if (!matches) {
            this.variables = [];
        } else {
            this.variables = matches.map((match) => this.createSubExpressionVariable(match, this));
        }
    }

    public hasVariables() {
        return this.expression.indexOf('$') > -1;
    }

    public getSubValue() {
        if (!this.locals) {
            return this.expression;
        } else {
            return [
                this.expression,
                this.locals,
            ];
        }
    }

    private createSubExpressionVariable(match: string, that: SubExpression): ISubExpressionVeriable {
        const expression = match.substr(2, match.length - 3);
        const parts = expression.split('.');
        const result: ISubExpressionVeriable = {
            replace: (replacement: string) => {
                that.expression = that.expression.replace(match, replacement);
            },
            resource: parts[0],
        };

        if (parts.length > 1) {
            result.path = parts[1];
            if (parts.length > 2) {
                for (let i = 2; i < parts.length; i++) {
                    result.path += '.' + parts[i];
                }
            }
        }

        return result;
    }

}

interface ISubExpressionVeriable {
    resource: string;
    path?: string;
    replace(replacement: string): void;
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
    Value: ICfnValue;
    Description: string;
}

interface ICfnCrossAccountReference {
    accountId: string;
    region: string;
    stackName: string;
    resourceLogicalId: string;
    path?: string;
    referenceType: 'GetAtt' | 'Ref';
    valueType: 'String' | 'CommaDelimitedList';
    uniqueNameForExport: string;
    expressionForExport: ICfnValue;
    uniqueNameForImport: string;
}
