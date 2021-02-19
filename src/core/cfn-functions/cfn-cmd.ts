import { execSync } from 'child_process';
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

            try {
                const process = execSync(val);
                const stdout = process.toString().trimRight();
                resourceParent[resourceKey] = stdout;
            } catch (error) {
                throw new OrgFormationError(`Fn::Cmd expression failed: ${error}`);
            }
        }
    }
}
