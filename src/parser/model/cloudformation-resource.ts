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
    public regions: string[];
    public resourceHash: string;
    public resourceForTemplate: any;
    public normalizedBoundAccounts?: string[];
    public normalizedForeachAccounts?: string[];
    private foreach: IOrganizationBindings;
    private bindings: IOrganizationBindings;

    constructor(root: TemplateRoot, id: string, resource: IResource) {
        super(root, id, resource);

        this.bindings = this.resource.OrganizationBindings as IOrganizationBindings;
        this.foreach = this.resource.Foreach as IOrganizationBindings;
        if (this.bindings) {

            if (typeof this.bindings.Regions === 'string') {
                this.regions = [this.bindings.Regions];
            } else {
                this.regions = this.bindings.Regions;
            }

        } else {
            this.regions = [];
        }

        const resourceString = JSON.stringify(resource);
        this.resourceHash = md5(resourceString);
        this.resourceForTemplate = JSON.parse(JSON.stringify(resource));
        delete this.resourceForTemplate.OrganizationBindings;
        delete this.resourceForTemplate.Foreach;
    }

    public calculateHash()  {
        return this.resourceHash;
    }

    public resolveRefs() {
        if (this.bindings) {
            this.normalizedBoundAccounts = this.resolveNormalizedLogicalAccountIds(this.bindings);
        }
        if (this.foreach) {
            this.normalizedForeachAccounts = this.resolveNormalizedLogicalAccountIds(this.foreach);
        }
    }

    private resolveNormalizedLogicalAccountIds(bidning: IOrganizationBindings): string[] {
        const accounts = super.resolve(bidning.Accounts, this.root.organizationSection.accounts);
        const excludeAccounts = super.resolve(bidning.ExcludeAccounts, this.root.organizationSection.accounts);
        const organizationalUnits = super.resolve(bidning.OrganizationalUnits, this.root.organizationSection.organizationalUnits);

        const accountLogicalIds = accounts.map((x) => x.TemplateResource.logicalId);
        const result = new Set<string>(accountLogicalIds);
        for (const unit of organizationalUnits) {
            const accountsForUnit = unit.TemplateResource.accounts.map((x) => x.TemplateResource.logicalId);
            for (const logicalId of accountsForUnit) {
                result.add(logicalId);
            }
        }
        if (this.bindings.IncludeMasterAccount) {
            if (this.root.organizationSection.masterAccount) {
                result.add(this.root.organizationSection.masterAccount.logicalId);
            } else {
                new OrgFormationError('unable to include master account if master account is not part of the template');
            }
        }

        for (const account of excludeAccounts.map((x) => x.TemplateResource.logicalId)) {
            result.delete(account);
        }

        return [...result];
    }
}
