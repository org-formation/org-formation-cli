import { IResource, IResourceRef, TemplateRoot } from '../parser';
import { Resource } from './resource';

export interface IAccountProperties {
    RootEmail: string;
    AccountName: string;
    AccountId: string;
    ServiceControlPolicies: IResourceRef | IResourceRef[];
}

export class AccountResource extends Resource {
    public accountName: string;
    public rootEmail: string;
    public serviceControlPolicies: IResourceRef[];

    constructor(root: TemplateRoot, id: string, resource: IResource) {
        super(root, id, resource);

        const props = this.resource.Properties as IAccountProperties;

        this.rootEmail = props.RootEmail;
        this.accountName = props.AccountName;
        this.serviceControlPolicies = ToArray(props.ServiceControlPolicies);
    }
}

function ToArray(val: IResourceRef | IResourceRef[]): IResourceRef[] {
    if (!val) {
        return [];
    } else if (!Array.isArray(val)) {
        return [val];
    } else {
        return val;
    }
}
