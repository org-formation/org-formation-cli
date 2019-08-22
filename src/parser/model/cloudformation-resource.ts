import md5 = require('md5');
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

export class CloudFormationResource extends Resource {
    public accounts: Array<Reference<AccountResource>>;
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
            this.organizationalUnits = super.resolve(this.bindings.OrganizationalUnits, this.root.organizationSection.organizationalUnits);
        }
    }

    public getNormalizedBoundAccounts(): string[] {
        const result = this.accounts.map((x) => x.TemplateResource.logicalId);
        for (const unit of this.organizationalUnits) {
            const accountsForUnit = unit.TemplateResource.accounts.map((x) => x.TemplateResource.logicalId);
            result.push(...accountsForUnit);
        }
        if (this.includeMasterAccount) {
            //todo: get real master account ref
            //todo: validate whether master account is in template
            result.push('MasterAccount');
        }
        return result;
    }
}
