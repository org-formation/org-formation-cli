import { ICfnFunctionContext } from './cfn-functions';
import { CfnExpressionResolver } from '~core/cfn-expression-resolver';
import { OrgFormationError } from '~org-formation-error';

export class CfnSub {

    static resolve(context: ICfnFunctionContext, resource: any, resourceParent: any, resourceKey: string, key: string, val: any): void {
        if (key === 'Fn::Sub' && typeof val === 'object' && Array.isArray(val) && val.length === 2) {
            if (val.length !== 2) {
                throw new OrgFormationError('Complex Fn::Sub expression expected to have 2 array elements (expression and object with parameters)');
            }

            const resolver = new CfnExpressionResolver();
            const parameters = Object.entries(val[1]);
            for (const param of parameters) {
                resolver.addParameter(param[0], param[1] as string);
            }

            const value = await resolver.resolveFirstPass({ 'Fn::Sub': val[0] });
            resourceParent[resourceKey] = value;
        }
    }
}
