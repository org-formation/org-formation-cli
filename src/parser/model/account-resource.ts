import md5 = require('md5');
import { OrgFormationError } from '../../org-formation-error';
import { IResource, IResourceRef, TemplateRoot } from '../parser';
import { PasswordPolicyResource } from './password-policy-resource';
import { Reference, Resource } from './resource';
import { ServiceControlPolicyResource } from './service-control-policy-resource';

export interface IAccountProperties {
    RootEmail?: string;
    AccountName: string;
    AccountId?: string;
    ServiceControlPolicies?: IResourceRef | IResourceRef[];
    PasswordPolicy?: IResourceRef;
    Alias?: string;
    Tags?: Record<string, string>;
    SupportLevel?: string;
}

export class AccountResource extends Resource {
    public accountName?: string;
    public rootEmail?: string;
    public accountId?: string;
    public alias?: string;
    public tags?: Record<string, string>;
    public serviceControlPolicies?: Array<Reference<ServiceControlPolicyResource>>;
    public passwordPolicy?: Reference<PasswordPolicyResource>;
    public organizationalUnitName?: string;
    public supportLevel?: string;
    private props?: IAccountProperties;

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
        this.supportLevel = this.props.SupportLevel;

        if (this.supportLevel !== undefined) {
            if (!['basic', 'developer', 'business', 'enterprise'].includes(this.supportLevel)) {
                throw new OrgFormationError(`Unexpected value for SupportLevel on account ${id}. Found: ${this.supportLevel}, Exported one of 'basic', 'developer', 'business', 'enterprise'.`);
            }
        }

        if (typeof this.accountId === 'number') {
            this.accountId = '' + this.accountId;
        }
        if (this.accountId && !/\d{12}/.test(this.accountId)) {
            throw new OrgFormationError(`AccountId is expected to be 12 digits on Account ${id}`);
        }
        this.tags = this.props.Tags;
        this.alias = this.props.Alias;

        super.throwForUnknownAttributes(resource, id, 'Type', 'Properties');
        super.throwForUnknownAttributes(this.props, id, 'RootEmail', 'AccountName', 'AccountId', 'Alias', 'ServiceControlPolicies', 'Tags', 'PasswordPolicy', 'SupportLevel');
    }

    public calculateHash(): string {
        const contents: any = { resource: this.resource, logicalId: this.logicalId };
        if (this.passwordPolicy && this.passwordPolicy.TemplateResource) {
            contents.passwordPolicyHash = this.passwordPolicy.TemplateResource.calculateHash();
        }

        const s = JSON.stringify(contents, null, 2);
        return md5(s);
    }

    public resolveRefs() {
        if (this.props) {
            this.serviceControlPolicies = super.resolve(this.props.ServiceControlPolicies, this.root.organizationSection.serviceControlPolicies);
            const passwordPolicies = super.resolve(this.props.PasswordPolicy, this.root.organizationSection.passwordPolicies);
            if (passwordPolicies.length !== 0) {
                this.passwordPolicy = passwordPolicies[0];
            }
        }
    }
}
