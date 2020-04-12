import { OrgFormationError } from '../org-formation-error';
import { ICfnExpression } from '~core/cfn-expression';
import { ResourceUtil } from '~util/resource-util';
import { AccountResource, Resource } from '~parser/model';
import { PersistedState } from '~state/persisted-state';
import { TemplateRoot } from '~parser/parser';


interface IResolver {
    resolve: (resource: string, path?: string) => string;
}

export class CfnExpressionResolver {
    readonly parameters: Record<string, string> = {};
    readonly globalResolvers: IResolver[] = [];
    readonly resolvers: Record<string, IResolver> = {};

    addResourceWithAttributes(resource: string, attributes: Record<string, string>): void {
        this.resolvers[resource] = { resolve: (resourceName: string, path?: string): string => {
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

    addResolver(resolve: (resource: string, path?: string) => string): void {
        this.globalResolvers.push( { resolve } );
    }

    addResourceWithResolverFn(resource: string, resolve: (resource: string, path?: string) => string): void {
        this.resolvers[resource] = { resolve };
    }

    public resolveSingleExpression(expression: ICfnExpression): string {
        if (typeof expression === 'string') {
            return expression;
        }
        const container = {val: expression};

        const resolved = this.resolve(container);

        if (typeof resolved.val === 'string') {
            return resolved.val;
        }
        throw new OrgFormationError(`unable to completely resolve expression. Parts unable to resolve: ${container.val}`);
    }

    public resolve<T>(obj: T): T {
        const expressions = ResourceUtil.EnumExpressionsForResource(obj, 'any');
        for(const expression of expressions) {

            const paramVal = this.parameters[expression.resource];
            if (paramVal && !expression.path) {
                expression.resolveToValue(paramVal);
                continue;
            }

            const resource = this.resolvers[expression.resource];
            if (resource) {
                const resourceVal = resource.resolve(expression.resource, expression.path);
                expression.resolveToValue(resourceVal);
                continue;
            }

            for(const resolver of this.globalResolvers) {
                const resolverVal = resolver.resolve(expression.resource, expression.path);
                if (resolverVal) {
                    expression.resolveToValue(resolverVal);
                    break;
                }
            }
        }
        return obj;

    }

    static ResolveAccountExpressionByLogicalName(logicalName: string, path: string | undefined, template: TemplateRoot, state: PersistedState): string | undefined {
        const account = template.organizationSection.findAccount(x=>x.logicalId === logicalName);
        if (account === undefined) {throw new OrgFormationError(`cannot find account with logical name ${logicalName}`);}
        return CfnExpressionResolver.ResolveAccountExpression(account, path, state);
    }

    static ResolveAccountExpression(account: AccountResource, path: string | undefined, state: PersistedState): string | undefined {
        if (path === undefined || path === 'AccountId') {
            return CfnExpressionResolver.resolveResourceRef(account, state);
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

    private static resolveResourceRef(resource: Resource, state: PersistedState): string {
        const binding = state.getBinding(resource.type, resource.logicalId);
        if (binding === undefined) {
            throw new OrgFormationError(`unable to find ${resource.logicalId} in state. Is your organization up to date?`);
        }
        return binding.physicalId;
    }

}
