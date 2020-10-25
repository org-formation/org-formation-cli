import path from 'path';
import { OrgFormationError } from '~org-formation-error';
import { yamlParseWithIncludes } from '~yaml-cfn/yaml-parse-includes';

export class CfnInclude {

    static resolve(filePath: string, resource: any, resourceParent: any, resourceKey: string, key: string, val: any): void {
        if (key === 'Fn::Include')
        {
            if (typeof val !== 'string') {
                throw new OrgFormationError(`Fn::Include expression expects a string as value. Found ${typeof val}`);
            }
            const included = CfnInclude.includeToAny(filePath, val);
            resourceParent[resourceKey] = included;
        }
    }

    static includeToAny(contextPath: string, filePath: string): any {
        const dir = path.dirname(contextPath);
        const resolvedFilePath = path.resolve(dir, filePath);
        return yamlParseWithIncludes(resolvedFilePath);
    }
}
