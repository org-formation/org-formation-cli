import { IResource, IResourceRef, TemplateRoot } from '../parser';
import { AccountResource } from './account-resource';
import { OrganizationalUnitResource } from './organizational-unit-resource';
import { Reference, Resource } from './resource';
export interface IOrganizationBindings {
    OrganizationalUnits: IResourceRef | IResourceRef[];
    Accounts: IResourceRef | IResourceRef[];
    Regions: string | string[];
    IncludeMasterAccount: boolean;
}
export declare class CloudFormationResource extends Resource {
    accounts: Array<Reference<AccountResource>>;
    organizationalUnits: Array<Reference<OrganizationalUnitResource>>;
    includeMasterAccount: boolean;
    regions: string[];
    resourceHash: string;
    resourceForTemplate: any;
    private bindings;
    constructor(root: TemplateRoot, id: string, resource: IResource);
    calculateHash(): string;
    resolveRefs(): void;
    getNormalizedBoundAccounts(): string[];
}
