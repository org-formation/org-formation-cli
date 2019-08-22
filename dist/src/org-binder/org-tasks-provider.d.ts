import { AwsOrganizationWriter } from '../aws-provider/aws-organization-writer';
import { AccountResource } from '../parser/model/account-resource';
import { OrganizationalUnitResource } from '../parser/model/organizational-unit-resource';
import { ServiceControlPolicyResource } from '../parser/model/service-control-policy-resource';
import { TemplateRoot } from '../parser/parser';
import { IBinding, PersistedState } from '../state/persisted-state';
export declare class TaskProvider {
    private state;
    private previousTemplate;
    private writer;
    constructor(currentTemplate: TemplateRoot, persistedState: PersistedState, writer: AwsOrganizationWriter);
    createPolicyCreateTasks(resource: ServiceControlPolicyResource, hash: string): IBuildTask[];
    createPolicyUpdateTasks(resource: ServiceControlPolicyResource, physicalId: string, hash: string): IBuildTask[];
    createPolicyDeleteTasks(binding: IBinding): IBuildTask[];
    createOrganizationalUnitCreateTasks(resource: OrganizationalUnitResource, hash: string): IBuildTask[];
    createOrganizationalUnitUpdateTasks(resource: OrganizationalUnitResource, physicalId: string, hash: string): IBuildTask[];
    createOrganizationalUnitDeleteTasks(binding: IBinding): IBuildTask[];
    createAccountCreateTasks(resource: AccountResource, hash: string): IBuildTask[];
    private createDetachSCPTask;
    private createAttachSCPTask;
    private createAttachAccountTask;
    private resolveIDs;
}
export interface IBuildTask {
    type: string;
    logicalId: string;
    action: BuildTaskAction;
    result?: any;
    dependentTasks?: IBuildTask[];
    dependentTaskFilter?: (task: IBuildTask) => boolean;
    perform: (task: IBuildTask) => Promise<void>;
}
declare type BuildTaskAction = 'Create' | 'Update' | 'Delete' | 'Relate' | 'CommitHash';
export {};
