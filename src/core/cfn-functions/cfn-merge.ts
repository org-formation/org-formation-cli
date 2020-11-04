import { ICfnFunctionContext } from './cfn-functions';

export class CfnMerge {

    static resolve(context: ICfnFunctionContext, resource: any, resourceParent: any, resourceKey: string, key: string, val: any): void {
        if (key === '<<' && typeof val === 'object') {
            const declaredMap = { ...resourceParent[resourceKey] };
            delete declaredMap['<<'];
            resourceParent[resourceKey] = {...val, ...declaredMap};
        }
    }
}
