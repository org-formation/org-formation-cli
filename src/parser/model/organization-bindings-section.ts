import { OrgFormationError } from '../../org-formation-error';
import { IOrganizationBinding, TemplateRoot } from '../parser';

export class OrganizationBindingsSection {
    public readonly bindings: Record<string, IOrganizationBinding> = {};
    public readonly defaultBinding?: IOrganizationBinding;
    public readonly defaultRegion?: string | string[];

    constructor(root: TemplateRoot, bindings?: Record<string, IOrganizationBinding>) {
        this.bindings = bindings;
        this.defaultBinding = root.defaultOrganizationBinding;
        this.defaultRegion = root.defaultOrganizationBindingRegion;

        if (this.defaultBinding !== undefined && this.defaultBinding.Region === undefined) {
            this.defaultBinding.Region = this.defaultRegion;
        }

        if (!this.bindings) { return; }

        for (const bindingName in bindings) {
            const binding = bindings[bindingName];
            if (binding === null || binding === undefined) { continue; }
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
