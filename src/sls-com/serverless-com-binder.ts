import path from 'path';
import { GenericBinder, IGenericBinding } from '~core/generic-binder';
import { ChildProcessUtility } from '~core/child-process-util';

export class ServerlessComBinder extends GenericBinder<IServerlessComTask> {

    createPerformForDelete(binding: IGenericBinding<IServerlessComTask>): () => Promise<void> {
        const { task, target } = binding;
        let command = 'npx sls remove';
        command = appendArgumentIfTruthy(command, '--stage', task.stage);
        command = appendArgumentIfTruthy(command, '--region', target.region);
        command = appendArgumentIfTruthy(command, '--config', task.configFile);

        const accountId = target.accountId;
        const cwd = path.resolve(task.path);
        const that = this;

        return async (): Promise<void> => {
            await ChildProcessUtility.SpawnProcessForAccount(cwd, command, accountId);
            that.state.removeGenericTarget(task.type, task.name, target.accountId, target.region);
        };
    }

    createPerformForUpdateOrCreate(binding: IGenericBinding<IServerlessComTask>): () => Promise<void> {
        const { task, target } = binding;
        let command = 'npm i && npx sls deploy';
        command = appendArgumentIfTruthy(command, '--stage', task.stage);
        command = appendArgumentIfTruthy(command, '--region', target.region);
        command = appendArgumentIfTruthy(command, '--config', task.configFile);

        const accountId = target.accountId;
        const cwd = path.resolve(task.path);
        const that = this;

        return async (): Promise<void> => {
            await ChildProcessUtility.SpawnProcessForAccount(cwd, command, accountId);
            that.state.setGenericTarget<IServerlessComTask>(target);
        };
    }
}

const appendArgumentIfTruthy = (command: string, option: string, val?: string): string => {
    if (!val) return command;
    return `${command} ${option} ${val}`;
}


export interface IServerlessComTask {
    name: string;
    type: string;
    hash: string;
    stage: string;
    path: string;
    configFile?: string;
}
