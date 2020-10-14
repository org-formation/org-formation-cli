import path from 'path';
import md5 from 'md5';
import { ICfnFunctionContext } from './cfn-functions';
import { Md5Util } from '~util/md5-util';

export class CfnMD5 {

    static resolve(context: ICfnFunctionContext, resource: any, resourceParent: any, resourceKey: string, key: string, val: any): void {
        if (key === 'Fn::MD5')
        {
            resourceParent[resourceKey] = CfnMD5.calcMd5(val);
        }
        else if (key === 'Fn::MD5Dir' || key === 'Fn::MD5File')
        {
            const dir = path.dirname(context.filePath);
            const resolvedFilePath = path.resolve(dir, val);
            resourceParent[resourceKey] = Md5Util.Md5OfPath(resolvedFilePath);
        }
    }

    static calcMd5(contents: any): string {
        if (typeof contents === 'string') {
            return md5(contents);
        } else {
            return md5(JSON.stringify(contents));
        }
    }
}
