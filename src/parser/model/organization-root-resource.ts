import { IResource, IResourceRef, TemplateRoot } from '../parser';
import { AccountResource } from './account-resource';
import { Reference, Resource } from './resource';
import { ServiceControlPolicyResource } from './service-control-policy-resource';

export interface IOrganizationRootProperties {
    ServiceControlPolicies: IResourceRef | IResourceRef[];
    Tags: Record<string, string>;
}

export class OrganizationRootResource extends Resource {
    public serviceControlPolicies: Array<Reference<ServiceControlPolicyResource>>;
    public tags: Record<string, string>;
    private props: IOrganizationRootProperties;

    constructor(root: TemplateRoot, id: string, resource: IResource) {
        super(root, id, resource);

        this.props = this.resource.Properties as IOrganizationRootProperties;
        this.tags = this.props.Tags;

        super.throwForUnknownAttributes(this.props, id, 'ServiceControlPolicies', 'Tags' );
    }

    public resolveRefs() {
        this.serviceControlPolicies = super.resolve(this.props.ServiceControlPolicies, this.root.organizationSection.serviceControlPolicies);
    }
}
