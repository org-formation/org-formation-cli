import md5 from 'md5';
import { ICfnFunctionContext } from './cfn-functions';
import { OrgFormationError } from '~org-formation-error';

export class CfnJoin {

    static resolve(context: ICfnFunctionContext, resource: any, resourceParent: any, resourceKey: string, key: string, val: any): void {
        if (key === 'Fn::Join') {
            if (!Array.isArray(val)) {
                if (!context.finalPass) { return; }
                throw new OrgFormationError('Fn::Join expression expected array as value (separator and list of elements)');
            }

            if (val.length !== 2) {
                if (!context.finalPass) { return; }
                throw new OrgFormationError('Fn::Join expression expected to have 2 array elements (separator and list of elements)');
            }

            if (typeof val[0] !== 'string') {
                if (!context.finalPass) { return; }
                throw new OrgFormationError(`Fn::Join expression first argument expected to be string. found ${val[0]} of type ${typeof val[0]}.`);
            }

            if (!Array.isArray(val[1])) {
                if (!context.finalPass) { return; }
                throw new OrgFormationError(`Fn::Join expression second argument expected to be array. found ${val[1]} of type ${typeof val[1]}.`);
            }

            for (const element of val[1]) {
                if (typeof element === 'object') {
                    if (!context.finalPass) { return; }
                    throw new OrgFormationError(`Unable to !Join element, Does this contain an expression that could not fully resolve?\n ${JSON.stringify(element)}`);
                }
            }

            const joinElements = val[1];
            const joined = joinElements.join(val[0]);


            resourceParent[resourceKey] = joined;
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
