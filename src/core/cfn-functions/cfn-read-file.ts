import { readFileSync } from 'fs';
import path from 'path';
import { ICfnFunctionContext } from './cfn-functions';
import { OrgFormationError } from '~org-formation-error';

export class CfnReadFile {

    static resolve(context: ICfnFunctionContext, resource: any, resourceParent: any, resourceKey: string, key: string, val: any): void {
        if (key === 'Fn::ReadFile')
        {
            if (typeof val !== 'string') {
                if (!context.finalPass) { return; }
                throw new OrgFormationError(`Fn::ReadFile expression expects a string as value. Found ${typeof val}`);
            }

            const resolved = CfnReadFile.readFile(context.filePath, val);
            resourceParent[resourceKey] = resolved;
        }
    }

    static readFile(contextPath: string, filePath: string): string {
        const dir = path.dirname(contextPath);
        const resolvedFilePath = path.resolve(dir, filePath);
        return readFileSync(resolvedFilePath).toString('utf-8');
    }
}
