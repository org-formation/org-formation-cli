import { ICfnFunctionContext } from './cfn-functions';
import { OrgFormationError } from '~org-formation-error';

export class CfnSelect {

    static resolve(context: ICfnFunctionContext, resource: any, resourceParent: any, resourceKey: string, key: string, val: any): void {
        if (key === 'Fn::Select')
        {
            if (!Array.isArray(val)) {
                if (!context.finalPass) { return; }
                throw new OrgFormationError(`Fn::Select expression expects an array as value. Found ${typeof val}`);
            }
            if (typeof val[0] !== 'number') {
                if (!context.finalPass) { return; }
                throw new OrgFormationError(`Fn::Select expression expects a number as first element in value. Found ${typeof val[0]}`);
            }
            const arr = val[1];
            if (!Array.isArray(arr)) {
                if (!context.finalPass) { return; }
                throw new OrgFormationError(`Fn::Select expression expects an array as second element in value. Found ${typeof val[1]}`);
            }

            const index = val[0];

            if (index >= arr.length) {
                if (!context.finalPass) { return; }
                throw new OrgFormationError(`Fn::Select expression selects index ${index} from array with length of ${arr.length}. expected index in between 0 and ${arr.length -1}`);
            }
            const selected = arr[index];
            resourceParent[resourceKey] = selected;
        }
    }
}
