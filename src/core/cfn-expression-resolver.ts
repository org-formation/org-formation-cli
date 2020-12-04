import { OrgFormationError } from '../org-formation-error';
import { CfnMappingsSection } from './cfn-functions/cfn-find-in-map';
import { CfnFunctions, ICfnFunctionContext } from './cfn-functions/cfn-functions';
import { ICfnExpression, ICfnSubExpression } from '~core/cfn-expression';
import { ResourceUtil } from '~util/resource-util';
import { AccountResource, OrganizationSection, Resource } from '~parser/model';
import { PersistedState } from '~state/persisted-state';
import { AwsUtil } from '~util/aws-util';
import { Validator } from '~parser/validator';
import { BaseCliCommand } from '~commands/base-command';


interface IResolver {
    resolve: (resolver: CfnExpressionResolver, resource: string, path?: string) => string | Promise<string>;
}

interface ITreeResolver<T> {
    resolve: (resolver: CfnExpressionResolver, obj: T) => Promise<T>;
}


export class CfnExpressionResolver {
    readonly parameters: Record<string, string> = {};
    readonly resolvers: Record<string, IResolver> = {};
    readonly globalResolvers: IResolver[] = [];
    readonly treeResolvers: ITreeResolver<any>[] = [];
    private mapping: CfnMappingsSection;
    private filePath: string;

    addResourceWithAttributes(resource: string, attributes: Record<string, string>): void {
        this.resolvers[resource] = { resolve: (resolver: CfnExpressionResolver, resourceName: string, path?: string): string => {
            const val = attributes[path];
            if (val === undefined) {
                throw new OrgFormationError(`unable to resolve expression, resource ${resourceName} does not have attribute ${path}`);
            }
            return val;
        } };
    }

    addMappings(mapping: CfnMappingsSection): void {
        this.mapping = mapping;
    }

    setFilePath(filePath: string): void {
        this.filePath = filePath;
    }

    addParameter(key: string, value: string): void {
        this.parameters[key] = value;
    }

    addResolver(resolve: (resolver: CfnExpressionResolver, resource: string, path?: string) => string): void {
        this.globalResolvers.push( { resolve } );
    }

    addTreeResolver<T>(resolve: (resolver: CfnExpressionResolver, obj: T) => Promise<T>): void {
        this.treeResolvers.push( { resolve });
    }

    addResourceWithResolverFn(resource: string, resolve: (resolver: CfnExpressionResolver, resource: string, path?: string) => string | Promise<string>): void {
        this.resolvers[resource] = { resolve };
    }

    public async resolveSingleExpression(expression: ICfnExpression, attributeName: string): Promise<string> {
        if (typeof expression === 'string' || typeof expression === 'undefined') {
            return expression;
        }

        if (expression === null) {
            return undefined;
        }

        const container = {val: expression};

        const resolved = await this.resolve(container);
        const collapsed = await this.collapse(resolved);

        if (typeof collapsed.val === 'string') {
            return collapsed.val;
        }
        Validator.throwForUnresolvedExpressions(collapsed.val, attributeName);
    }

    public resolveFirstPass<T>(obj: T): T {
        if (obj === undefined) {return undefined;}
        const clone = JSON.parse(JSON.stringify(obj)) as T;

        const container = {val: clone};
        const expressions = ResourceUtil.EnumExpressionsForResource(container, 'any');
        for(const expression of expressions) {

            const paramVal = this.parameters[expression.resource];
            if (!expression.path && paramVal !== undefined) {
                if (typeof paramVal !== 'object') {
                    expression.resolveToValue(paramVal);
                } else {
                    const valueAsExpression = ResourceUtil.GetExpression(paramVal);
                    if (valueAsExpression) {
                        const resource = valueAsExpression.resource;
                        const path = valueAsExpression.path;
                        expression.rewriteExpression(resource, path);
                    }
                }
                continue;
            }
        }
        const context: ICfnFunctionContext = { filePath: this.filePath, mappings: this.mapping, finalPass: false };
        const resolved = CfnFunctions.resolveTreeStructural(context, true, container);
        return resolved.val;
    }

    public async resolve<T>(obj: T): Promise<T> {
        if (obj === undefined) {return undefined;}

        const resolved = this.resolveFirstPass(obj);
        const container = {val: resolved};
        const expressions = ResourceUtil.EnumExpressionsForResource(container, 'any');
        for(const expression of expressions) {
            const resource = this.resolvers[expression.resource];
            if (resource) {
                const resourceVal = await resource.resolve(this, expression.resource, expression.path);
                expression.resolveToValue(resourceVal);
                continue;
            }

            for(const resolver of this.globalResolvers) {
                const resolverVal = await resolver.resolve(this, expression.resource, expression.path);
                if (resolverVal) {
                    expression.resolveToValue(resolverVal);
                    break;
                }
            }
        }
        for(const treeResolver of this.treeResolvers) {
            await treeResolver.resolve(this, container);
        }

        return container.val;
    }

    public async collapse<T>(obj: T): Promise<T> {
        if (obj === undefined) {return undefined;}

        const clone = JSON.parse(JSON.stringify(obj)) as T;
        const container = {val: clone};
        const expressions = ResourceUtil.EnumCfnFunctionsForResource(container);
        for(const expression of expressions.reverse()) {
            if (expression.type === 'Sub') {
                const subExpression = expression.target as ICfnSubExpression;
                if (Array.isArray(subExpression['Fn::Sub'])) {
                    const arr = subExpression['Fn::Sub'];
                    if (arr.length !== 2) {
                        throw new OrgFormationError('Complex Fn::Sub expression expected to have 2 array elements (expression and object with parameters)');
                    }
                    const resolver = new CfnExpressionResolver();
                    const parameters = Object.entries(arr[1]);
                    for(const param of parameters) {
                        resolver.addParameter(param[0], param[1] as string);
                    }

                    const value = await resolver.resolveSingleExpression({'Fn::Sub': arr[0]} as ICfnSubExpression, 'Sub');
                    expression.resolveToValue(value);
                }
            }
        }

        const context: ICfnFunctionContext = { filePath: this.filePath, mappings: this.mapping, finalPass: true };
        CfnFunctions.resolveTreeStructural(context, true, container);

        return container.val;
    }

    static ResolveOrganizationExpressionByLogicalName(logicalName: string, path: string | undefined, organization: OrganizationSection, state: PersistedState): string | undefined {
        const account = organization.findAccount(x=>x.logicalId === logicalName);
        if (account !== undefined) {
            return CfnExpressionResolver.ResolveAccountExpression(account, path, state);
        }

        const resource = organization.findResource(x=>x.logicalId === logicalName);
        if (resource !== undefined) {
            return CfnExpressionResolver.ResolveResourceRef(resource, state);
        }

        return undefined;
    }

    static ResolveAccountExpression(account: AccountResource, path: string | undefined, state: PersistedState): string | undefined {
        if (path === undefined || path === 'AccountId') {
            return CfnExpressionResolver.ResolveResourceRef(account, state);
        }
        if (path.startsWith('Tags.')) {
            const tagName = path.substring(5);
            if (!account.tags) {
                throw new OrgFormationError(`unable to resolve account attribute ${account.logicalId}.${path}. Account has no Tags`);
            }
            const tagValue = account.tags[tagName];
            if (tagValue === undefined) {
                throw new OrgFormationError(`unable to resolve account attribute ${account.logicalId}.${path}. Tag ${tagName} not found on account`);
            }
            return tagValue;
        } else if (path === 'AccountName') {
            if (!account.accountName) { return ''; }
            return account.accountName;
        } else if (path === 'Alias') {
            if (!account.alias) { return ''; }
            return account.alias;
        } else if (path === 'RootEmail') {
            if (!account.rootEmail) { return ''; }
            return account.rootEmail;
        }
        if (!path.startsWith('Resources.')) {
            throw new OrgFormationError(`unable to resolve account attribute ${account.logicalId}.${path}`);
        }
        return undefined;
    }

    private static ResolveResourceRef(resource: Resource, state: PersistedState): string {
        const binding = state.getBinding(resource.type, resource.logicalId);
        if (binding === undefined) {
            throw new OrgFormationError(`unable to find ${resource.logicalId} in state. Is your organization up to date?`);
        }
        return binding.physicalId;
    }

    public static ValueUsedForUnresolvedCopyValueExpression = 'value-used-for-unresolved-copy-value-on-validation';

    private static async ResolveCopyValueFunctions<T>(resolver: CfnExpressionResolver, targetAccount: string, targetRegion: string, taskRoleName: string,  obj: T, finalPerform: boolean): Promise<T> {
        const functions = ResourceUtil.EnumFunctionsForResource(obj);

        for(const fn of functions) {
            const processed = await resolver.resolve(fn);
            const exportName = processed.exportName;
            const accountId = processed.accountId ?? targetAccount;
            const region = processed.region ?? targetRegion;
            let val = await AwsUtil.GetCloudFormationExport(exportName, accountId, region, taskRoleName);
            if (val === undefined) {
                if (finalPerform) {
                    throw new OrgFormationError(`unable to find export ${exportName} in account ${accountId}/${region}.`);
                } else {
                    val = CfnExpressionResolver.ValueUsedForUnresolvedCopyValueExpression;
                }
            }
            fn.resolveToValue(val);
        }

        return obj;
    }

    public static CreateDefaultResolver(logicalAccountName: string, accountId: string, region: string, taskRoleName: string, organizationSection: OrganizationSection, state: PersistedState, finalPerform: boolean): CfnExpressionResolver {
        const resolver = new CfnExpressionResolver();
        resolver.addParameter('AWS::AccountId', accountId);
        resolver.addParameter('AWS::Region', region);
        resolver.addParameter('ORG::StateBucketName', BaseCliCommand.StateBucketName);

        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        const currentAccountResolverFn = (that: CfnExpressionResolver, resource: string, resourcePath: string | undefined) => CfnExpressionResolver.ResolveOrganizationExpressionByLogicalName(logicalAccountName, resourcePath, organizationSection, state);

        resolver.addResourceWithResolverFn('CurrentAccount', currentAccountResolverFn);
        resolver.addResourceWithResolverFn('AWSAccount', currentAccountResolverFn);
        resolver.addResourceWithResolverFn('ORG::PrincipalOrgID', () => AwsUtil.GetPrincipalOrgId());
        resolver.addResolver((that: CfnExpressionResolver, resource: string, resourcePath: string | undefined) => CfnExpressionResolver.ResolveOrganizationExpressionByLogicalName(resource, resourcePath, organizationSection, state));

        resolver.addTreeResolver((that: CfnExpressionResolver, obj) => CfnExpressionResolver.ResolveCopyValueFunctions(that, accountId, region, taskRoleName, obj, finalPerform));

        return resolver;
    }
}
