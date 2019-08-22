import { IResourceTarget } from '../parser/model/resources-section';
import { TemplateRoot } from '../parser/parser';
import { ICfnTarget, PersistedState } from '../state/persisted-state';
import { CfnTaskProvider, ICfnTask } from './cfn-task-provider';
import { CfnTransform } from './cfn-transform';
export declare class CloudFormationBinder {
    private template;
    private state;
    private taskProvider;
    private templateTransform;
    private masterAccount;
    constructor(template: TemplateRoot, state: PersistedState, taskProvider?: CfnTaskProvider, templateTransform?: CfnTransform);
    enumBindings(): ICfnBinding[];
    enumTasks(): ICfnTask[];
}
export interface ICfnBinding {
    accountId: string;
    region: string;
    stackName: string;
    action: CfnBindingAction;
    template?: IResourceTarget;
    state?: ICfnTarget;
    templateHash?: string;
}
declare type CfnBindingAction = 'UpdateOrCreate' | 'Delete' | 'None';
export {};
