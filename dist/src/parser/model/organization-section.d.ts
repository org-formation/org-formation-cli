import { IOrganization, IResource, TemplateRoot } from '../parser';
import { AccountResource } from './account-resource';
import { MasterAccountResource } from './master-account-resource';
import { OrganizationRootResource } from './organization-root-resource';
import { OrganizationalUnitResource } from './organizational-unit-resource';
import { Resource } from './resource';
import { ServiceControlPolicyResource } from './service-control-policy-resource';
export declare class OrganizationSection {
    readonly root: TemplateRoot;
    readonly contents: IOrganization;
    masterAccount: MasterAccountResource;
    organizationRoot: OrganizationRootResource;
    readonly resources: Resource[];
    readonly accounts: AccountResource[];
    readonly organizationalUnits: OrganizationalUnitResource[];
    readonly serviceControlPolicies: ServiceControlPolicyResource[];
    constructor(root: TemplateRoot, contents: IOrganization);
    resolveRefs(): void;
    createResource(id: string, resource: IResource): Resource;
    private throwForDuplicateVale;
}
