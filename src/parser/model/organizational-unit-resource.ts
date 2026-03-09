import { OrgFormationError } from '../../org-formation-error';
import { IResource, IResourceRef, TemplateRoot } from '../parser';
import { AccountResource } from './account-resource';
import { PolicyResource } from './policy-resource';
import { Reference, Resource } from './resource';
import { ServiceControlPolicyResource } from './service-control-policy-resource';

export interface IOrganizationalUnitProperties {
    OrganizationalUnitName: string;
    Accounts?: string[] | IResourceRef | IResourceRef[];
    OrganizationalUnits?: string[] | IResourceRef | IResourceRef[];
    ServiceControlPolicies?: IResourceRef | IResourceRef[];
    Policies?: IResourceRef | IResourceRef[];
}

export class OrganizationalUnitResource extends Resource {
    public organizationalUnitName: string;
    public accounts: Reference<AccountResource>[] = [];
    public organizationalUnits: Reference<OrganizationalUnitResource>[] = [];
    public serviceControlPolicies: Reference<ServiceControlPolicyResource | PolicyResource>[] = [];
    public parentOULogicalName: string;
    private props: IOrganizationalUnitProperties;

    constructor(root: TemplateRoot, id: string, resource: IResource) {
        super(root, id, resource);

        if (resource.Properties === undefined) {
            throw new OrgFormationError(`Properties are missing for resource ${id}`);
        }

        this.props = this.resource.Properties as IOrganizationalUnitProperties;

        if (!this.props.OrganizationalUnitName) {
            throw new OrgFormationError(`OrganizationalUnitName is missing on Organizational Unit ${id}`);
        }

        this.organizationalUnitName = this.props.OrganizationalUnitName;

        super.throwForNonRef(this.props.OrganizationalUnits, 'OrganizationalUnits');
        super.throwForNonRef(this.props.Accounts, 'Accounts');
        super.throwForUnknownAttributes(resource, id, 'Type', 'Properties');
        super.throwForUnknownAttributes(this.props, id, 'OrganizationalUnitName', 'Accounts', 'ServiceControlPolicies', 'Policies', 'OrganizationalUnits');
    }

    public resolveRefs(): void {
        this.accounts = super.resolve(this.props.Accounts, this.root.organizationSection.accounts, this.root.organizationSection.masterAccount);
        this.organizationalUnits = super.resolve(this.props.OrganizationalUnits, this.root.organizationSection.organizationalUnits);
        for(const child of this.organizationalUnits) {
            child.TemplateResource.parentOULogicalName = this.logicalId;
        }
        const allPolicies = [...this.root.organizationSection.serviceControlPolicies, ...this.root.organizationSection.policies];

        // Resolve both ServiceControlPolicies and Policies properties
        const scpRefs = super.resolve(this.props.ServiceControlPolicies, allPolicies);
        const policyRefs = super.resolve(this.props.Policies, allPolicies);

        // Merge both lists, removing duplicates
        this.serviceControlPolicies = [...scpRefs];
        for (const policyRef of policyRefs) {
            const isDuplicate = this.serviceControlPolicies.some(existing =>
                existing.TemplateResource?.logicalId === policyRef.TemplateResource?.logicalId ||
                existing.PhysicalId === policyRef.PhysicalId
            );
            if (!isDuplicate) {
                this.serviceControlPolicies.push(policyRef);
            }
        }

        const referenceToSelf = this.organizationalUnits.find(x=>x.TemplateResource === this);
        if (referenceToSelf !== undefined) {
            throw new OrgFormationError(`organizational unit ${this.organizationalUnitName} has a reference to self on child OrganizationalUnits.`);
        }
        const accountWithOtherOrgUnit = this.accounts.find(x => x.TemplateResource && (x.TemplateResource.organizationalUnitName !== undefined));
        if (accountWithOtherOrgUnit) {
            throw new OrgFormationError(`account ${accountWithOtherOrgUnit.TemplateResource!.logicalId} is part of multiple organizational units, e.g. ${this.logicalId} and ${accountWithOtherOrgUnit.TemplateResource!.organizationalUnitName}.`);
        }

        for (const account of this.accounts) {
            if (account.TemplateResource) {
                account.TemplateResource.organizationalUnitName = this.logicalId;
            }
        }

    }
}
