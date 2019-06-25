import { IResource, IResourceRef, TemplateRoot } from '../parser';
import { Resource } from './resource';

export interface IOrganizationalUnitProperties {
    OrganizationalUnitName: string;
    Accounts: IResourceRef | IResourceRef[];
    ServiceControlPolicies: IResourceRef | IResourceRef[];
}

export class OrganizationalUnitResource extends Resource {
    public organizationalUnitName: string;
    public accounts: IResourceRef[];
    public serviceControlPolicies: IResourceRef[];

    constructor(root: TemplateRoot, id: string, resource: IResource) {
        super(root, id, resource);

        const props = this.resource.Properties as IOrganizationalUnitProperties;
        this.organizationalUnitName = props.OrganizationalUnitName;
        this.accounts = ToArray(props.Accounts);
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
