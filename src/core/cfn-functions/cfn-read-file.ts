import path from 'path';
import { ICfnFunctionContext } from './cfn-functions';
import { OrgFormationError } from '~org-formation-error';
import { FileUtil } from '~util/file-util';

export class CfnReadFile {

    static async resolve(context: ICfnFunctionContext, resource: any, resourceParent: any, resourceKey: string, key: string, val: any): Promise<string> {
        if (key === 'Fn::ReadFile')
        {
            if (typeof val !== 'string') {
                if (!context.finalPass) { return; }
                throw new OrgFormationError(`Fn::ReadFile expression expects a string as value. Found ${typeof val}`);
            }

            let resolvedFilePath = val;
            if (!FileUtil.IsRemoteFile(val)) {
                const dir = path.dirname(context.filePath);
                resolvedFilePath = path.resolve(dir, val);
            }

            const resolved = await FileUtil.GetContents(resolvedFilePath);
            resourceParent[resourceKey] = resolved;
        }
    }
}
