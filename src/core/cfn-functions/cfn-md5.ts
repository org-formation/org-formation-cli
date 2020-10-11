import md5 from 'md5';
import { ICfnFunctionContext } from './cfn-functions';

export class CfnMD5 {

    static resolve(context: ICfnFunctionContext, resource: any, resourceParent: any, resourceKey: string, key: string, val: any): void {
        if (key === 'Fn::MD5')
        {
            resourceParent[resourceKey] = md5(val);
        }
    }

    static md5(contents: any): string {
        if (typeof contents === 'string') {
            return md5(contents);
        } else {
            return md5(JSON.stringify(contents));
        }
    }
}
