import { bool } from 'aws-sdk/clients/signer';
import { SubExpression } from './cfn-binder/cfn-sub-expression';

const zeroPad = (num: number, places: number): string => String(num).padStart(places, '0');

export class ResourceUtil {
    public static FixVersions(obj: any): void {
        if (obj !== null && typeof obj === 'object') {
            const entries = Object.entries(obj);
            for (const [key, val] of entries) {
                if (key === 'Version' && val instanceof Date) {
                    obj.Version = ResourceUtil.ToVersion(val);
                } else if (key === 'Version' && typeof val === 'string' && val.endsWith('T00:00:00.000Z')) {
                    obj.Version = val.substring(0, val.indexOf('T'));
                }
                if (val !== null && typeof val === 'object') {
                    this.FixVersions(val);
                }
            }
        }
    }

    public static ToVersion(date: Date): string {
        const year = date.getUTCFullYear();
        const month = zeroPad(1 + date.getUTCMonth(), 2);
        const day = zeroPad(date.getUTCDate(), 2);
        return `${year}-${month}-${day}`;
    }

    public static HasExpressions(resourceParent: any, resourceKey: string, resourceIds: string[]): bool {
        const resource = resourceParent[resourceKey];
        const expressions =  ResourceUtil.EnumExpressionsForResource(resource, resourceIds, resourceParent, resourceKey);
        return 0 < expressions.length;
    }

    public static EnumExpressions(resourceParent: any, resourceKey: string, resourceIds: string[]): IResourceExpression[] {
        const resource = resourceParent[resourceKey];
        return ResourceUtil.EnumExpressionsForResource(resource, resourceIds, resourceParent, resourceKey);
    }

    public static EnumExpressionsForResource(resource: any, resourceIds: string[], resourceParent?: any, resourceKey?: string): IResourceExpression[] {
        const result: IResourceExpression[] = [];
        if (resource !== null && typeof resource === 'object') {
            const entries = Object.entries(resource);
            if (entries.length === 1 && resourceParent !== undefined && resourceKey !== undefined) {
                const [key, val]: [string, unknown] = entries[0];
                if (key === 'Ref' && typeof val === 'string' && resourceIds.includes(val)) {
                    result.push({
                        resolveToValue: createResolveExpression(resourceParent, resourceKey),
                        rewriteExpression: createRewriteExpression(resourceParent, resourceKey),
                        resource: val,
                    });
                } else if (key === 'Fn::GetAtt') {
                    if (Array.isArray(val) && val.length === 2) {
                        if (resourceIds.includes(val[0])) {
                            result.push({
                                resolveToValue: createResolveExpression(resourceParent, resourceKey),
                                rewriteExpression: createRewriteExpression(resourceParent, resourceKey),
                                resource: val[0],
                                path: val[1],
                            });
                        }
                    }
                } else if (key === 'Fn::Sub') {
                    const sub = new SubExpression(val as string | any[]);
                    for (const variable of sub.variables) {
                        if (resourceIds.includes(variable.resource)) {
                            result.push({
                                resolveToValue: replacement => {
                                    variable.replace(replacement);
                                    if (!sub.hasVariables()) {
                                        resourceParent[resourceKey] = sub.getSubValue();
                                    } else {
                                        resource[key] = sub.getSubValue();
                                    }
                                },
                                rewriteExpression: (replacementResource, replacementPath) => {
                                    let expression = replacementResource;
                                    if (replacementPath !== undefined) {
                                        expression = expression + '.' + replacementPath;
                                    }
                                    variable.replace('${' + expression + '}');
                                    resource[key] = sub.getSubValue();
                                },
                                resource: variable.resource,
                                path: variable.path,
                            });
                        }
                    }
                }
            }

            for (const [key, val] of entries) {
                if (val !== null && typeof val === 'object') {
                   result.push(...ResourceUtil.EnumExpressionsForResource(val, resourceIds, resource, key));
                }
            }
        }
        return result;
    }

}

const createRewriteExpression = (parent: any, key: string) => {
    return (resource: string, path?: string): void => {
        if (path !== undefined) {
            parent[key] = { 'Fn::GetAtt': [resource, path]};
        } else {
            parent[key] = { Ref: resource };
        }
    };
};

const createResolveExpression = (parent: any, key: string) => {
    return (val: string): void => {
        parent[key] = val;
    };
};

interface IResourceExpression {
    resource: string;
    path?: string;
    rewriteExpression(resource: string, path?: string): void;
    resolveToValue(val: string): void;
}
