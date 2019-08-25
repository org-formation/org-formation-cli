import { IResource, IResourceRef, TemplateRoot } from '../parser';
import { AccountResource } from './account-resource';
import { Reference, Resource } from './resource';
import { ServiceControlPolicyResource } from './service-control-policy-resource';

export interface IOrganizationalUnitProperties {
    OrganizationalUnitName: string;
    Accounts?: string[] | IResourceRef | IResourceRef[];
    ServiceControlPolicies?: IResourceRef | IResourceRef[];
}

export class OrganizationalUnitResource extends Resource {
    public organizationalUnitName: string;
    public accounts: Array<Reference<AccountResource>>;
    public serviceControlPolicies: Array<Reference<ServiceControlPolicyResource>>;
    private props: IOrganizationalUnitProperties;

    constructor(root: TemplateRoot, id: string, resource: IResource) {
        super(root, id, resource);

        this.props = this.resource.Properties as IOrganizationalUnitProperties;

        if (!this.props.OrganizationalUnitName) {
            throw new Error(`OrganizationalUnitName is missing on Organizational Unit ${id}`);
        }

        this.organizationalUnitName = this.props.OrganizationalUnitName;

        super.throwForUnknownAttributes(this.props, id, 'OrganizationalUnitName', 'Accounts', 'ServiceControlPolicies');
    }

    public resolveRefs() {
        this.accounts = super.resolve(this.props.Accounts, this.root.organizationSection.accounts);
        this.serviceControlPolicies = super.resolve(this.props.ServiceControlPolicies, this.root.organizationSection.serviceControlPolicies);

        const accountWithOtherOrgUnit = this.accounts.find((x) => x.TemplateResource && (x.TemplateResource.organizationalUnitName !== undefined));
        if (accountWithOtherOrgUnit) {
            throw new Error(`account ${accountWithOtherOrgUnit.TemplateResource.logicalId} is part of multiple organizational units, at least ${this.logicalId} and ${accountWithOtherOrgUnit.TemplateResource.organizationalUnitName}.`);
        }

        for (const account of this.accounts) {
            if (account.TemplateResource) {
                account.TemplateResource.organizationalUnitName = this.logicalId;
            }
        }

    }
}
