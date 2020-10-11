import { ICfnFunctionContext } from './cfn-functions';

export class CfnJsonString {

    static resolve(context: ICfnFunctionContext, resource: any, resourceParent: any, resourceKey: string, key: string, val: any): void {
        if (key === 'Fn::JsonString') {

            let obj = val;
            let prettyPrint = false;
            if (Array.isArray(obj)) {
                if (obj.length === 2 && obj[1] === 'pretty-print') {
                    prettyPrint = true;
                }
                obj = obj[0];
            }

            const result = CfnJsonString.toJsonString(obj, prettyPrint);
            resourceParent[resourceKey] = result;
        }
    }

    private static toJsonString(val: any, prettyPrint: boolean): string {
        let result = '';
        if (typeof val === 'string') {
            const parsed = JSON.parse(val);
            result = JSON.stringify(parsed, null, prettyPrint? 2 : 0);
        } else {
            result = JSON.stringify(val, null, prettyPrint? 2 : 0);
        }
        return result;
    }
}
