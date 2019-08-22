import { IResource, IResourceRef, TemplateRoot } from '../parser';
import { AccountResource } from './account-resource';
import { Reference, Resource } from './resource';
import { ServiceControlPolicyResource } from './service-control-policy-resource';

export interface IMasterAccountProperties {
    RootEmail: string;
    AccountName: string;
    AccountId: string;
    ServiceControlPolicies: IResourceRef | IResourceRef[];
}

export class MasterAccountResource extends AccountResource {

    constructor(root: TemplateRoot, id: string, resource: IResource) {
        super(root, id, resource);
    }

}
