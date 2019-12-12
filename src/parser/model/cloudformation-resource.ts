import md5 = require('md5');
import { ConsoleUtil } from '../../console-util';
import { OrgFormationError } from '../../org-formation-error';
import { IOrganizationBinding, IResource, IResourceRef, TemplateRoot } from '../parser';
import { Resource } from './resource';

export class CloudFormationResource extends Resource {
    public regions: string[];
    public resourceHash: string;
    public resourceForTemplate: any;
    public normalizedBoundAccounts?: string[];
    public normalizedForeachAccounts?: string[];
    public dependsOnAccount: string[] = [];
    public dependsOnRegion: string[] = [];
    private dependsOnAccountRef?: IResourceRef | IResourceRef[];
    private dependsOnRegionRef?: string | string[];
    private foreach: IOrganizationBinding;
    private binding: IOrganizationBinding;

    constructor(root: TemplateRoot, id: string, resource: IResource, defaultBinding?: IOrganizationBinding, defaultRegion?: string | string[]) {
        super(root, id, resource);

        if ((this.resource as any).OrganizationBindings) {
            throw new OrgFormationError(`Resource ${id} has an OrganizationBindings attribute which must be OrganizationBinding (without the S)`);
        }

        this.binding = this.resource.OrganizationBinding as IOrganizationBinding;

        if (!this.binding) {
            this.binding = defaultBinding;
            this.resource.OrganizationBinding = defaultBinding;
        }

        if (!this.binding) {
            throw new OrgFormationError(`Resource ${id} is missing OrganizationBinding attribute and no top level OrganizationBinding found.`);
        }

        if (!this.binding.Region) {
            this.binding.Region = defaultRegion;
        }

        super.throwForUnknownAttributes(this.binding, id + '.OrganizationBinding', 'OrganizationalUnit', 'Account', 'ExcludeAccount', 'Region', 'IncludeMasterAccount', 'AccountsWithTag');

        this.foreach = this.resource.Foreach as IOrganizationBinding;
        if (this.foreach) {
            super.throwForUnknownAttributes(this.foreach, id + '.Foreach', 'OrganizationalUnit', 'Account', 'ExcludeAccount', 'IncludeMasterAccount', 'AccountsWithTag');
        }

        if (this.binding && this.binding.Region) {
            if (typeof this.binding.Region === 'string') {
                this.regions = [this.binding.Region];
            } else {
                this.regions = this.binding.Region;
            }
        } else {
            this.regions = [];
            ConsoleUtil.LogWarning(`No binding found for resource ${id}. Either add defaults globally or OrganizationBinding to the resource attributes.`);
        }
        this.dependsOnAccountRef = this.resource.DependsOnAccount;
        this.dependsOnRegionRef = this.resource.DependsOnRegion;

        const resourceString = JSON.stringify(resource);
        this.resourceHash = md5(resourceString);
        this.resourceForTemplate = JSON.parse(JSON.stringify(resource));
        delete this.resourceForTemplate.OrganizationBinding;
        delete this.resourceForTemplate.Foreach;
        delete this.resourceForTemplate.DependsOnAccount;
        delete this.resourceForTemplate.DependsOnRegion;
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

        if (this.dependsOnAccountRef) {
            const accountsAndMaster = [...this.root.organizationSection.accounts, this.root.organizationSection.masterAccount];
            const resolvedResources = super.resolve(this.dependsOnAccountRef, accountsAndMaster);
            for (const resolved of resolvedResources) {
                if (resolved.TemplateResource && resolved.TemplateResource.logicalId) {
                    this.dependsOnAccount.push(resolved.TemplateResource.logicalId);
                }
            }

            if (this.dependsOnRegionRef) {
                if (typeof this.dependsOnRegionRef === 'string') {
                    this.dependsOnRegion = [this.dependsOnRegionRef];
                } else {
                    this.dependsOnRegion = this.dependsOnRegionRef;
                }
            }
        }
    }

    private resolveNormalizedLogicalAccountIds(binding: IOrganizationBinding): string[] {
        const organizationAccountsAndMaster = [this.root.organizationSection.masterAccount, ...this.root.organizationSection.accounts];
        const accounts = super.resolve(binding.Account, binding.Account === '*' ? this.root.organizationSection.accounts : organizationAccountsAndMaster);
        const excludeAccounts = super.resolve(binding.ExcludeAccount, binding.ExcludeAccount === '*' ? this.root.organizationSection.accounts : organizationAccountsAndMaster);
        const organizationalUnits = super.resolve(binding.OrganizationalUnit, this.root.organizationSection.organizationalUnits);

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
