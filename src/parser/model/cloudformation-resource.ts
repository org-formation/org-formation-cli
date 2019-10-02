import md5 = require('md5');
import { OrgFormationError } from '../../org-formation-error';
import { IResource, IResourceRef, TemplateRoot } from '../parser';
import { AccountResource } from './account-resource';
import { OrganizationalUnitResource } from './organizational-unit-resource';
import { Reference, Resource } from './resource';

export interface IOrganizationBindings {
    OrganizationalUnits: IResourceRef | IResourceRef[];
    Accounts: IResourceRef | IResourceRef[];
    ExcludeAccounts: IResourceRef | IResourceRef[];
    Regions: string | string[];
    IncludeMasterAccount: boolean;
}

export class CloudFormationResource extends Resource {
    public accounts: Array<Reference<AccountResource>>;
    public excludeAccounts: Array<Reference<AccountResource>>;
    public organizationalUnits: Array<Reference<OrganizationalUnitResource>>;
    public includeMasterAccount: boolean;
    public regions: string[];
    public resourceHash: string;
    public resourceForTemplate: any;
    private bindings: IOrganizationBindings;

    constructor(root: TemplateRoot, id: string, resource: IResource) {
        super(root, id, resource);

        this.bindings = this.resource.OrganizationBindings as IOrganizationBindings;
        if (this.bindings) {
            this.includeMasterAccount = this.bindings.IncludeMasterAccount;
            if (typeof this.bindings.Regions === 'string') {
                this.regions = [this.bindings.Regions];
            } else {
                this.regions = this.bindings.Regions;
            }

        } else {
            this.accounts = [];
            this.excludeAccounts = [];
            this.organizationalUnits = [];
            this.regions = [];
        }

        const resourceString = JSON.stringify(resource);
        this.resourceHash = md5(resourceString);
        this.resourceForTemplate = JSON.parse(JSON.stringify(resource));
        delete this.resourceForTemplate.OrganizationBindings;
    }

    public calculateHash()  {
        return this.resourceHash;
    }

    public resolveRefs() {
        if (this.bindings) {
            this.accounts = super.resolve(this.bindings.Accounts, this.root.organizationSection.accounts);
            this.excludeAccounts = super.resolve(this.bindings.ExcludeAccounts, []);
            this.organizationalUnits = super.resolve(this.bindings.OrganizationalUnits, this.root.organizationSection.organizationalUnits);
        }
    }

    public getNormalizedBoundAccounts(): string[] {
        const accountLogicalIds = this.accounts.map((x) => x.TemplateResource.logicalId);
        const result = new Set<string>(accountLogicalIds);
        for (const unit of this.organizationalUnits) {
            const accountsForUnit = unit.TemplateResource.accounts.map((x) => x.TemplateResource.logicalId);
            for(const logicalId of accountsForUnit){ 
                result.add(logicalId);
            }
        }
        if (this.includeMasterAccount) {
            if (this.root.organizationSection.masterAccount) {
                result.add(this.root.organizationSection.masterAccount.logicalId);
            } else {
                new OrgFormationError('unable to include master account if master account is not part of the template');
            }
        }
        
        for (const account of this.excludeAccounts.map(x=>x.TemplateResource.logicalId)) {
            result.delete(account);
        }

        return [...result];
    }
}
