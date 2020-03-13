import { GenericBinder, IGenericBinding } from '~core/generic-binder';
import { ChildProcessUtility } from '~core/child-process-util';
import path from 'path';

export class ServerlessComBinder extends GenericBinder<IServerlessComTask> {

    createPerformForDelete(binding: IGenericBinding<IServerlessComTask>): () => Promise<void> {
        const { task, target } = binding;
        let command = 'npx sls remove'
        if (task.stage) {
            command += ' --stage ' + task.stage;
        }
        if (target.region) {
            command += ' --region ' + target.region;
        }
        const accountId = target.accountId;
        const cwd = path.resolve(task.path);
        const that = this;

        return async () => {
            await ChildProcessUtility.SpawnProcessForAccount(cwd, command, accountId);
            that.state.removeGenericTarget(task.type, task.name, target.accountId, target.region);
        }
    }

    createPerformForUpdateOrCreate(binding: IGenericBinding<IServerlessComTask>): () => Promise<void> {
        const { task, target } = binding;
        let command = 'npm i && npx sls deploy'
        if (task.stage) {
            command += ' --stage ' + task.stage;
        }
        if (target.region) {
            command += ' --region ' + target.region;
        }
        const accountId = target.accountId;
        const cwd = path.resolve(task.path);
        const that = this;

        return async () => {
            await ChildProcessUtility.SpawnProcessForAccount(cwd, command, accountId);
            that.state.setGenericTarget<IServerlessComTask>(target);
        }
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
