import { OrgFormationError } from '../../org-formation-error';
import { IOrganizationBinding, IResource, IResources, TemplateRoot } from '../parser';
import { CloudFormationResource } from './cloudformation-resource';

export class OrganizationBindingsSection {
    public readonly bindings: Record<string, IOrganizationBinding> = {};
    public readonly defaultBinding?: IOrganizationBinding;
    public readonly defaultRegion?: string | string[];
    private readonly root: TemplateRoot;

    constructor(root: TemplateRoot, bindings?: Record<string, IOrganizationBinding>) {
        this.root = root;
        this.bindings = bindings;
        this.defaultBinding = root.defautOrganizationBinding;
        this.defaultRegion = root.defaultOrganizationBindingRegion;

        if (this.defaultBinding !== undefined && this.defaultBinding.Region === undefined) {
            this.defaultBinding.Region = this.defaultRegion;
        }

        if (!this.bindings) { return; }

        for (const bindingName in bindings) {
            const binding = bindings[bindingName];
            if (binding.Region === undefined) {
                binding.Region = this.defaultRegion;
            }
        }
    }

    public getBinding(logicalName: string): IOrganizationBinding {
        const result = this.bindings[logicalName];
        if (result === undefined) {throw new OrgFormationError(`unable to find binding with name ${logicalName}`); }
        return result;
    }
}
