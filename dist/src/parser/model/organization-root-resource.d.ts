import { IResource, IResourceRef, TemplateRoot } from '../parser';
import { Reference, Resource } from './resource';
import { ServiceControlPolicyResource } from './service-control-policy-resource';
export interface IOrganizationRootProperties {
    ServiceControlPolicies: IResourceRef | IResourceRef[];
}
export declare class OrganizationRootResource extends Resource {
    serviceControlPolicies: Array<Reference<ServiceControlPolicyResource>>;
    tags: Record<string, string>;
    private props;
    constructor(root: TemplateRoot, id: string, resource: IResource);
    resolveRefs(): void;
}
