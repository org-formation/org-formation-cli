import { GenericBinder, IGenericBinding } from '~core/generic-binder';
import { ChildProcessUtility } from '~core/child-process-util';
import { AwsUtil } from 'src/aws-util';

export class ServerlessComBinder extends GenericBinder<IServerlessComTask> {

    createPerformForDelete(binding: IGenericBinding<IServerlessComTask>): () => Promise<void> {
        const { task, target } = binding;
        let command = 'serverless remove'
        if (task.stage) {
            command += ' --stage ' + task.stage;
        }
        if (target.region) {
            command += ' --region ' + target.region;
        }
        const accountId = target.accountId;
        const cwd = task.path;

        return () => ChildProcessUtility.SpawnProcessForAccount(cwd, command, accountId);
    }

    createPerformForUpdateOrCreate(binding: IGenericBinding<IServerlessComTask>): () => Promise<void> {
        const { task, target } = binding;
        let command = 'serverless deploy'
        if (task.stage) {
            command += ' --stage ' + task.stage;
        }
        if (target.region) {
            command += ' --region ' + target.region;
        }
        const accountId = target.accountId;
        const cwd = task.path;

        return () => ChildProcessUtility.SpawnProcessForAccount(cwd, command, accountId);
    }
}


export interface IServerlessComTask {
    name: string;
    type: string;
    hash: string;
    stage: string;
    path: string;
    configFile?: string;
}
