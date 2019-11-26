import md5 = require('md5');
import { OrgFormationError } from '../../org-formation-error';
import { IOrganizationBinding, IResource, IResourceRef, TemplateRoot } from '../parser';
import { Resource } from './resource';

export class CloudFormationResource extends Resource {
    public regions: string[];
    public resourceHash: string;
    public resourceForTemplate: any;
    public normalizedBoundAccounts?: string[];
    public normalizedForeachAccounts?: string[];
    private foreach: IOrganizationBinding;
    private binding: IOrganizationBinding;

    constructor(root: TemplateRoot, id: string, resource: IResource, defaultBinding?: IOrganizationBinding) {
        super(root, id, resource);

        this.binding = this.resource.OrganizationBindings as IOrganizationBinding;
        if (!this.binding) {
            this.binding = defaultBinding;
        }
        if (this.binding) {
            super.throwForUnknownAttributes(this.binding, id + '.OrganizationBindings', 'OrganizationalUnits', 'Accounts', 'ExcludeAccounts', 'Regions', 'IncludeMasterAccount', 'AccountsWithTag');
        }
        this.foreach = this.resource.Foreach as IOrganizationBinding;
        if (this.foreach) {
            super.throwForUnknownAttributes(this.foreach, id + '.Foreach', 'OrganizationalUnits', 'Accounts', 'ExcludeAccounts', 'IncludeMasterAccount', 'AccountsWithTag');
        }

        if (this.binding) {
            if (typeof this.binding.Regions === 'string') {
                this.regions = [this.binding.Regions];
            } else {
                this.regions = this.binding.Regions;
            }

        } else {
            this.regions = [];
            // throw new Error(`no binding found for resource ${id}. Either add an OrganizationBindings attribute to the resource or globally to the template.`);
        }

        const resourceString = JSON.stringify(resource);
        this.resourceHash = md5(resourceString);
        this.resourceForTemplate = JSON.parse(JSON.stringify(resource));
        delete this.resourceForTemplate.OrganizationBindings;
        delete this.resourceForTemplate.Foreach;
    }

    public calculateHash() {
        return this.resourceHash;
    }

    public resolveRefs() {
        if (this.binding) {
            this.normalizedBoundAccounts = this.resolveNormalizedLogicalAccountIds(this.binding);
        }
        if (this.foreach) {
            this.normalizedForeachAccounts = this.resolveNormalizedLogicalAccountIds(this.foreach);
        }
    }

    private resolveNormalizedLogicalAccountIds(binding: IOrganizationBinding): string[] {

        const accounts = super.resolve(binding.Accounts, this.root.organizationSection.accounts);
        const excludeAccounts = super.resolve(binding.ExcludeAccounts, this.root.organizationSection.accounts);
        const organizationalUnits = super.resolve(binding.OrganizationalUnits, this.root.organizationSection.organizationalUnits);

        const accountLogicalIds = accounts.map((x) => x.TemplateResource!.logicalId);
        const result = new Set<string>(accountLogicalIds);
        for (const unit of organizationalUnits) {
            const accountsForUnit = unit.TemplateResource!.accounts.map((x) => x.TemplateResource!.logicalId);
            for (const logicalId of accountsForUnit) {
                result.add(logicalId);
            }
        }
        if (binding.IncludeMasterAccount) {
            if (this.root.organizationSection.masterAccount) {
                result.add(this.root.organizationSection.masterAccount.logicalId);
            } else {
                new OrgFormationError('unable to include master account if master account is not part of the template');
            }
        }

        if (binding.AccountsWithTag) {
            const tagToMatch = binding.AccountsWithTag;
            const accountsWithTag = this.root.organizationSection.findAccounts((x) => (x.tags !== undefined) && Object.keys(x.tags).indexOf(tagToMatch) !== -1);
            for (const account of accountsWithTag.map((x) => x.logicalId)) {
                result.add(account);
            }
        }

        for (const account of excludeAccounts.map((x) => x.TemplateResource!.logicalId)) {
            result.delete(account);
        }

        return [...result];
    }
}
