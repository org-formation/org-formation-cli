import { PersistedState } from '../state/persisted-state';
import { ICfnBinding } from './cfn-binder';
export declare class CfnTaskProvider {
    private state;
    constructor(state: PersistedState);
    createUpdateTemplateTask(binding: ICfnBinding, template: string, hash: string): ICfnTask[];
    createDeleteTemplateTask(binding: ICfnBinding): ICfnTask[];
    private createCreateCloudFormationFn;
}
export interface ICfnTask {
    action: CfnBuildTaskAction;
    accountId: string;
    region: string;
    stackName: string;
    perform: (task: ICfnTask) => Promise<void>;
}
declare type CfnBuildTaskAction = 'UpdateOrCreate' | 'Delete';
export {};
