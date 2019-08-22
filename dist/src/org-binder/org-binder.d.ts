import { AccountResource } from '../parser/model/account-resource';
import { MasterAccountResource } from '../parser/model/master-account-resource';
import { OrganizationalUnitResource } from '../parser/model/organizational-unit-resource';
import { Resource } from '../parser/model/resource';
import { ServiceControlPolicyResource } from '../parser/model/service-control-policy-resource';
import { TemplateRoot } from '../parser/parser';
import { IBinding, PersistedState } from '../state/persisted-state';
import { IBuildTask, TaskProvider } from './org-tasks-provider';
export declare class OrganizationBinder {
    private taskProvider;
    private template;
    private state;
    private masterAccount;
    constructor(template: TemplateRoot, state: PersistedState, taskProvider: TaskProvider);
    getBindings(): BindingRoot;
    getOrganizationBindings(): OrganizationBinding;
    enumBuildTasks(): IBuildTask[];
}
export declare class BindingRoot {
    organization: OrganizationBinding;
}
export declare class OrganizationBinding {
    policies: ServiceControlPolicyBinding[];
    organizationalUnits: OrganizationalUnitBinding[];
    accounts: AccountBinding[];
    masterAccount: Binding<MasterAccountResource>;
}
declare type BindingAction = 'Create' | 'Update' | 'Delete' | 'None';
declare class Binding<TResource extends Resource> {
    static getBinding<TResource extends Resource>(state: PersistedState, templateResource: TResource): Binding<TResource>;
    protected static enumerateBindings<TResource extends Resource>(type: string, templateResources: TResource[], state: PersistedState): Array<Binding<TResource>>;
    template?: TResource;
    state?: IBinding;
    action: BindingAction;
    templateHash?: string;
}
declare class AccountBinding extends Binding<AccountResource> {
    static enumerateAccountBindings(template: TemplateRoot, state: PersistedState): AccountBinding[];
}
declare class OrganizationalUnitBinding extends Binding<OrganizationalUnitResource> {
    static enumerateOrganizationalUnitBindings(template: TemplateRoot, state: PersistedState): OrganizationalUnitBinding[];
}
declare class ServiceControlPolicyBinding extends Binding<ServiceControlPolicyResource> {
    static enumerateServiceControlBindings(template: TemplateRoot, state: PersistedState): ServiceControlPolicyBinding[];
}
export {};
