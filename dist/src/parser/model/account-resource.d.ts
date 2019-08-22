import { IResource, IResourceRef, TemplateRoot } from '../parser';
import { Reference, Resource } from './resource';
import { ServiceControlPolicyResource } from './service-control-policy-resource';
export interface IAccountProperties {
    RootEmail: string;
    AccountName: string;
    AccountId: string;
    ServiceControlPolicies?: IResourceRef | IResourceRef[];
    Tags?: Record<string, string>;
}
export declare class AccountResource extends Resource {
    accountName: string;
    rootEmail: string;
    accountId: string;
    tags: Record<string, string>;
    serviceControlPolicies: Array<Reference<ServiceControlPolicyResource>>;
    organizationalUnitName: string;
    private props;
    constructor(root: TemplateRoot, id: string, resource: IResource);
    resolveRefs(): void;
}
