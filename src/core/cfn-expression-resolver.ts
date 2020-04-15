import { OrgFormationError } from '../org-formation-error';
import { ICfnExpression, ICfnSubExpression } from '~core/cfn-expression';
import { ResourceUtil } from '~util/resource-util';
import { AccountResource, Resource } from '~parser/model';
import { PersistedState } from '~state/persisted-state';
import { TemplateRoot } from '~parser/parser';
import { AwsUtil } from '~util/aws-util';


interface IResolver {
    resolve: (resolver: CfnExpressionResolver, resource: string, path?: string) => string;
}

interface ITreeResolver<T> {
    resolve: (resolver: CfnExpressionResolver, obj: T) => Promise<T>;
}


export class CfnExpressionResolver {
    readonly parameters: Record<string, string> = {};
    readonly resolvers: Record<string, IResolver> = {};
    readonly globalResolvers: IResolver[] = [];
    readonly treeResolvers: ITreeResolver<any>[] = [];

    addResourceWithAttributes(resource: string, attributes: Record<string, string>): void {
        this.resolvers[resource] = { resolve: (resolver: CfnExpressionResolver, resourceName: string, path?: string): string => {
            const val = attributes[path];
            if (val === undefined) {
                throw new OrgFormationError(`unable to resolve expression, resource ${resourceName} does not have attribute ${path}`);
            }
            return val;
        } };
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

    addResourceWithResolverFn(resource: string, resolve: (resolver: CfnExpressionResolver, resource: string, path?: string) => string): void {
        this.resolvers[resource] = { resolve };
    }

    public async resolveSingleExpression(expression: ICfnExpression): Promise<string> {
        if (typeof expression === 'string') {
            return expression;
        }
        const container = {val: expression};

        const resolved = await this.resolve(container);

        if (typeof resolved.val === 'string') {
            return resolved.val;
        }
        throw new OrgFormationError(`unable to completely resolve expression. Parts unable to resolve: ${container.val}`);
    }

    public async resolve<T>(obj: T): Promise<T> {
        if (obj === undefined) {return undefined;}

        const clone = JSON.parse(JSON.stringify(obj)) as T;

        const container = {val: clone};
        const expressions = ResourceUtil.EnumExpressionsForResource(container, 'any');
        for(const expression of expressions) {

            const paramVal = this.parameters[expression.resource];
            if (paramVal && !expression.path) {
                expression.resolveToValue(paramVal);
                continue;
            }

            const resource = this.resolvers[expression.resource];
            if (resource) {
                const resourceVal = resource.resolve(this, expression.resource, expression.path);
                expression.resolveToValue(resourceVal);
                continue;
            }

            for(const resolver of this.globalResolvers) {
                const resolverVal = resolver.resolve(this, expression.resource, expression.path);
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

                    const value = await resolver.resolveSingleExpression({'Fn::Sub': arr[0]} as ICfnSubExpression);
                    expression.resolveToValue(value);
                }
            }
        }

        return container.val;
    }

    static ResolveAccountExpressionByLogicalName(logicalName: string, path: string | undefined, template: TemplateRoot, state: PersistedState): string | undefined {
        const account = template.organizationSection.findAccount(x=>x.logicalId === logicalName);
        if (account === undefined) { return undefined; }
        return CfnExpressionResolver.ResolveAccountExpression(account, path, state);
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

    private static async ResolveCopyValueFunctions<T>(resolver: CfnExpressionResolver, targetAccount: string, targetRegion: string, taskRoleName: string,  obj: T): Promise<T> {
        const functions = ResourceUtil.EnumFunctionsForResource(obj);
        for(const fn of functions) {
            const processed = await resolver.resolve(fn);
            const exportName = processed.exportName;
            const accountId = processed.accountId ?? targetAccount;
            const region = processed.region ?? targetRegion;
            const val = await AwsUtil.GetCloudFormationExport(exportName, accountId, region, taskRoleName);
            if (val === undefined) {
                throw new OrgFormationError(`unable to find export ${exportName} in account ${accountId}/${region}.`);
            }
            fn.resolveToValue(val);
        }

        return obj;
    }

    public static CreateDefaultResolver(logicalAccountName: string, accountId: string, region: string, taskRoleName: string, template: TemplateRoot, state: PersistedState): CfnExpressionResolver {
        const resolver = new CfnExpressionResolver();
        resolver.addParameter('AWS::AccountId', accountId);
        resolver.addParameter('AWS::Region', region);
        resolver.addResourceWithResolverFn('CurrentAccount', (that: CfnExpressionResolver, resource: string, resourcePath: string | undefined) => CfnExpressionResolver.ResolveAccountExpressionByLogicalName(logicalAccountName, resourcePath, template, state));
        resolver.addResolver((that: CfnExpressionResolver, resource: string, resourcePath: string | undefined) => CfnExpressionResolver.ResolveAccountExpressionByLogicalName(resource, resourcePath, template, state));
        resolver.addTreeResolver((that: CfnExpressionResolver, obj) => CfnExpressionResolver.ResolveCopyValueFunctions(that, accountId, region, taskRoleName, obj));

        return resolver;
    }
}
