import { IResource, IResourceRef, TemplateRoot } from '../parser';
import { AccountResource } from './account-resource';
import { Reference, Resource } from './resource';
import { ServiceControlPolicyResource } from './service-control-policy-resource';
export interface IOrganizationalUnitProperties {
    OrganizationalUnitName: string;
    Accounts?: string[] | IResourceRef | IResourceRef[];
    ServiceControlPolicies?: IResourceRef | IResourceRef[];
}
export declare class OrganizationalUnitResource extends Resource {
    organizationalUnitName: string;
    accounts: Array<Reference<AccountResource>>;
    serviceControlPolicies: Array<Reference<ServiceControlPolicyResource>>;
    private props;
    constructor(root: TemplateRoot, id: string, resource: IResource);
    resolveRefs(): void;
}
