import { IResource, IResourceRef, TemplateRoot } from '../parser';
import { PolicyResource } from './policy-resource';
import { Reference, Resource } from './resource';
import { ServiceControlPolicyResource } from './service-control-policy-resource';

export interface IOrganizationRootProperties {
    ServiceControlPolicies?: IResourceRef | IResourceRef[];
    Policies?: IResourceRef | IResourceRef[];
    DefaultOrganizationAccessRoleName?: string;
    DefaultBuildAccessRoleName?: string;
    DefaultDevelopmentBuildAccessRoleName?: string;
    MirrorInPartition?: boolean;
    CloseAccountsOnRemoval?: boolean;
}


export class OrganizationRootResource extends Resource {
    public serviceControlPolicies: Reference<ServiceControlPolicyResource | PolicyResource>[] = [];
    private props: IOrganizationRootProperties;
    public defaultOrganizationAccessRoleName?: string;
    public defaultBuildAccessRoleName?: string;
    public defaultDevelopmentBuildAccessRoleName?: string;
    public mirrorInPartition?: boolean;
    public closeAccountsOnRemoval?: boolean;

    constructor(root: TemplateRoot, id: string, resource: IResource) {
        super(root, id, resource);

        this.props = this.resource.Properties as IOrganizationRootProperties;

        super.throwForUnknownAttributes(resource, id, 'Type', 'Properties');
        super.throwForUnknownAttributes(this.props, id, 'ServiceControlPolicies', 'Policies', 'DefaultOrganizationAccessRoleName', 'DefaultBuildAccessRoleName', 'DefaultDevelopmentBuildAccessRoleName', 'MirrorInPartition', 'CloseAccountsOnRemoval');

        if (this.props) {
            this.defaultOrganizationAccessRoleName = this.props.DefaultOrganizationAccessRoleName;
            this.defaultBuildAccessRoleName = this.props.DefaultBuildAccessRoleName;
            this.defaultDevelopmentBuildAccessRoleName = this.props.DefaultDevelopmentBuildAccessRoleName;
            this.mirrorInPartition = this.props.MirrorInPartition;
            this.closeAccountsOnRemoval = this.props.CloseAccountsOnRemoval;
        }
    }

    public resolveRefs(): void {
        if (this.props) {
            const allPolicies = [...this.root.organizationSection.serviceControlPolicies, ...this.root.organizationSection.policies];

            // Resolve both ServiceControlPolicies and Policies properties
            const scpRefs = super.resolve(this.props.ServiceControlPolicies, allPolicies);
            const policyRefs = super.resolve(this.props.Policies, allPolicies);

            // Merge both lists, removing duplicates
            const mergedPolicies = [...scpRefs];
            for (const policyRef of policyRefs) {
                const isDuplicate = mergedPolicies.some(existing =>
                    existing.TemplateResource?.logicalId === policyRef.TemplateResource?.logicalId ||
                    existing.PhysicalId === policyRef.PhysicalId
                );
                if (!isDuplicate) {
                    mergedPolicies.push(policyRef);
                }
            }
            this.serviceControlPolicies = mergedPolicies;
        } else  {
            this.serviceControlPolicies = [];
        }
    }
}
