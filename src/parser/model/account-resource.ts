import { OrgFormationError } from '../../org-formation-error';
import { IResource, IResourceRef, TemplateRoot } from '../parser';
import { Reference, Resource } from './resource';
import { ServiceControlPolicyResource } from './service-control-policy-resource';

export interface IAccountProperties {
    RootEmail?: string;
    AccountName: string;
    AccountId?: string;
    ServiceControlPolicies?: IResourceRef | IResourceRef[];
    Alias?: string;
    Tags?: Record<string, string>;
}

export class AccountResource extends Resource {
    public accountName: string;
    public rootEmail: string;
    public accountId: string;
    public alias: string;
    public tags: Record<string, string>;
    public serviceControlPolicies: Array<Reference<ServiceControlPolicyResource>>;
    public organizationalUnitName: string;
    private props: IAccountProperties;

    constructor(root: TemplateRoot, id: string, resource: IResource) {
        super(root, id, resource);

        if (resource.Properties === undefined) {
            throw new OrgFormationError(`Properties are missing for resource ${id}`);
        }

        this.props = this.resource.Properties as IAccountProperties;

        if (!this.props.AccountId && !this.props.RootEmail) {
            throw new OrgFormationError(`both AccountId and RootEmail are missing on Account ${id}`);
        }
        if (!this.props.AccountName) {
            throw new OrgFormationError(`AccountName is missing on Account ${id}`);
        }
        this.rootEmail = this.props.RootEmail;
        this.accountName = this.props.AccountName;
        this.accountId = this.props.AccountId;
        this.tags = this.props.Tags;
        this.alias = this.props.Alias;

        super.throwForUnknownAttributes(resource, id, 'Type', 'Properties');
        super.throwForUnknownAttributes(this.props, id, 'RootEmail', 'AccountName', 'AccountId', 'Alias', 'ServiceControlPolicies', 'Tags');
    }

    public resolveRefs() {
        this.serviceControlPolicies = super.resolve(this.props.ServiceControlPolicies, this.root.organizationSection.serviceControlPolicies);
    }
}
