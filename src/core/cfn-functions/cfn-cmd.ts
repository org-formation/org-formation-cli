import { promisify } from 'util';
import { exec as childExec } from 'child_process';
import { ICfnFunctionContext } from './cfn-functions';
import { OrgFormationError } from '~org-formation-error';

export class CfnCmd {

    static async resolve(context: ICfnFunctionContext, resource: any, resourceParent: any, resourceKey: string, key: string, val: any): Promise<string> {
        if (key === 'Fn::Cmd')
        {
            if (typeof val !== 'string') {
                if (!context.finalPass) { return; }
                throw new OrgFormationError(`Fn::Cmd expression expects a string as value. Found ${typeof val}`);
            }

            const resolved = await CfnCmd.run(context.filePath, val);
            resourceParent[resourceKey] = resolved;
        }
    }

    static async run(contextPath: string, command: string): Promise<string> {
        try {
            const exec = promisify(childExec);
            const cmd = await exec(command);
            return cmd.stdout;
        } catch (error) {
            throw new OrgFormationError(`Fn::Cmd failed to execute ${command} with ${error}`);
        }
    }

}
