import {exec} from 'child_process';
import { ICfnFunctionContext } from './cfn-functions';
import { OrgFormationError } from '~org-formation-error';

export class CfnCmd {

    static resolve(context: ICfnFunctionContext, resource: any, resourceParent: any, resourceKey: string, key: string, val: any): void {
        if (key === 'Fn::Cmd')
        {
            if (typeof val !== 'string') {
                if (!context.finalPass) { return; }
                throw new OrgFormationError(`Fn::Cmd expression expects a string as value. Found ${typeof val}`);
            }

            exec(val, (error, stdout, stderr) => {
              if (error) {
                throw new OrgFormationError(`Fn::Cmd expression ${val} failed with error ${error}`);
              } else {
                  resourceParent[resourceKey] = `${stdout}`.trimRight();
              }
            });
        }
    }
}
