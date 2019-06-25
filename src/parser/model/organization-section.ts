import { IOrganization, IResource, TemplateRoot } from '../parser';
import { AccountResource } from './account-resource';
import { MasterAccountResource } from './master-account-resource';
import { OrganizationalUnitResource } from './organizational-unit-resource';
import { Resource, UnknownResource } from './resource';
import { ResourceTypes } from './resource-types';
import { ServiceControlPolicyResource } from './service-control-policy-resource';

export class OrganizationSection {
    public readonly root: TemplateRoot;
    public readonly contents: IOrganization;
    public masterAccount: MasterAccountResource;
    public readonly resources: Resource[] = [];
    public readonly accounts: AccountResource[] = [];
    public readonly organizationalUnits: OrganizationalUnitResource[] = [];
    public readonly serviceControlPolicies: ServiceControlPolicyResource[] = [];

    constructor(root: TemplateRoot, contents: IOrganization) {
        this.root = root;
        this.contents = contents;

        if (!this.contents) {
            return;
        }

        for (const id in this.contents)  {
            const resource = this.createResource(id, this.contents[id]);
            this.resources.push(resource);
        }

        for (const resource of this.resources) {
            if (resource instanceof MasterAccountResource) {
                this.masterAccount = resource;
            } else if (resource instanceof AccountResource) {
                this.accounts.push(resource);
            } else if (resource instanceof OrganizationalUnitResource) {
                this.organizationalUnits.push(resource);
            } else if (resource instanceof ServiceControlPolicyResource) {
                this.serviceControlPolicies.push(resource);
            }
        }
    }

    public createResource(id: string, resource: IResource): Resource {
        switch (resource.Type) {
            case ResourceTypes.MasterAccount:
                return new MasterAccountResource(this.root, id, resource);

            case ResourceTypes.Account:
                return new AccountResource(this.root, id, resource);

            case ResourceTypes.OrganizationalUnit:
                return new OrganizationalUnitResource(this.root, id, resource);

            case ResourceTypes.ServiceControlPolicy:
                return new ServiceControlPolicyResource(this.root, id, resource);

            default:
                return new UnknownResource(this.root, id, resource);
        }
    }
}
