import md5 = require('md5');
import { ConsoleUtil } from '../../util/console-util';
import { OrgFormationError } from '../../org-formation-error';
import { Validator } from '../validator';
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
    private foreachAccount: IOrganizationBinding;
    private binding: IOrganizationBinding;

    constructor(root: TemplateRoot, id: string, resource: IResource) {
        super(root, id, resource);

        const bindingsSection = root.bindingSection;

        if ((this.resource as any).OrganizationBindings) {
            throw new OrgFormationError(`Resource ${id} has an OrganizationBindings attribute which must be OrganizationBinding (without the S)`);
        }

        const bindingExpression =  this.resource.OrganizationBinding;
        if (bindingExpression && bindingExpression.Ref) {
            this.binding = bindingsSection.getBinding(bindingExpression.Ref);
        } else {
            this.binding = this.resource.OrganizationBinding as IOrganizationBinding;
        }

        if (this.binding === undefined) {
            this.binding = bindingsSection.defaultBinding;
            this.resource.OrganizationBinding = bindingsSection.defaultBinding;
        }

        if (this.binding === undefined) {
            throw new OrgFormationError(`Resource ${id} is missing OrganizationBinding attribute and no top level OrganizationBinding found.`);
        }

        if (this.binding != null && !this.binding.Region) {
            this.binding.Region = bindingsSection.defaultRegion;
        }

        if (this.binding != null && this.binding.Region === undefined) {
            ConsoleUtil.LogWarning(`Resource ${id} has binding without region. This means it will not be deployed to any account.`);
        }

        Validator.ValidateOrganizationBinding(this.binding, id + '.OrganizationBinding');

        if (this.resource.Foreach !== undefined) {
            ConsoleUtil.LogWarning(`resource ${id} specifies an attribute Foreach wich is deprecated. use ForeachAccount instead`);
            this.resource.ForeachAccount = this.resource.Foreach;
            delete this.resource.Foreach;
        }
        const foreachExpression = this.resource.ForeachAccount;
        if (foreachExpression && foreachExpression.Ref) {
            this.foreachAccount = bindingsSection.getBinding(foreachExpression.Ref);
        } else {
            this.foreachAccount = this.resource.ForeachAccount as IOrganizationBinding;
        }
        if (this.foreachAccount) {
            Validator.ValidateOrganizationBinding(this.foreachAccount, id + '.Foreach');
        }

        if (this.binding && this.binding.Region) {
            if (typeof this.binding.Region === 'string') {
                this.regions = [this.binding.Region];
            } else {
                this.regions = this.binding.Region;
            }
        } else {
            this.regions = [];
            if (this.binding === undefined) {
                ConsoleUtil.LogWarning(`No binding found for resource ${id}. Either add defaults globally or OrganizationBinding to the resource attributes.`);
            }
        }
        this.dependsOnAccountRef = this.resource.DependsOnAccount;
        this.dependsOnRegionRef = this.resource.DependsOnRegion;

        const resourceString = JSON.stringify(resource);
        this.resourceHash = md5(resourceString);
        this.resourceForTemplate = JSON.parse(JSON.stringify(resource));
        delete this.resourceForTemplate.OrganizationBinding;
        delete this.resourceForTemplate.ForeachAccount;
        delete this.resourceForTemplate.DependsOnAccount;
        delete this.resourceForTemplate.DependsOnRegion;
    }

    public calculateHash(): string {
        return this.resourceHash;
    }

    public resolveRefs(): void {
        if (this.binding) {
            this.normalizedBoundAccounts = this.root.resolveNormalizedLogicalAccountIds(this.binding);
        }
        if (this.foreachAccount) {
            this.normalizedForeachAccounts = this.root.resolveNormalizedLogicalAccountIds(this.foreachAccount);
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

}
