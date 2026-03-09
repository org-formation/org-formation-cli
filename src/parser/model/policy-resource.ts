import { OrgFormationError } from '../../org-formation-error';
import { ResourceUtil } from '../../util/resource-util';
import { IResource, TemplateRoot } from '../parser';
import { Resource } from './resource';

export type PolicyType =
    | 'SERVICE_CONTROL_POLICY'
    | 'RESOURCE_CONTROL_POLICY'
    | 'TAG_POLICY'
    | 'BACKUP_POLICY'
    | 'AISERVICES_OPT_OUT_POLICY'
    | 'CHATBOT_POLICY'
    | 'DECLARATIVE_POLICY_EC2'
    | 'SECURITYHUB_POLICY'
    | 'INSPECTOR_POLICY'
    | 'UPGRADE_ROLLOUT_POLICY'
    | 'BEDROCK_POLICY'
    | 'S3_POLICY'
    | 'NETWORK_SECURITY_DIRECTOR_POLICY';

export interface IPolicyProperties {
    PolicyName: string;
    Description?: string;
    PolicyDocument: any;
    PolicyType: PolicyType;
}

export class PolicyResource extends Resource {
    public policyName: string;
    public description?: string;
    public policyDocument: any;
    public policyType: PolicyType;

    constructor(root: TemplateRoot, id: string, resource: IResource) {
        super(root, id, resource);

        if (resource.Properties === undefined) {
            throw new OrgFormationError(`Properties are missing for resource ${id}`);
        }

        const props = this.resource.Properties as IPolicyProperties;

        if (!props.PolicyName) {
            throw new OrgFormationError(`PolicyName is missing on Policy ${id}`);
        }

        if (!props.PolicyDocument) {
            throw new OrgFormationError(`PolicyDocument is missing on Policy ${id}`);
        }

        if (!props.PolicyType) {
            throw new OrgFormationError(`PolicyType is missing on Policy ${id}`);
        }

        this.policyName = props.PolicyName;
        this.description = props.Description;
        this.policyDocument = props.PolicyDocument;
        this.policyType = props.PolicyType;

        ResourceUtil.FixVersions(this.policyDocument);
        super.throwForUnknownAttributes(resource, id, 'Type', 'Properties');
        super.throwForUnknownAttributes(props, id, 'PolicyName', 'Description', 'PolicyDocument', 'PolicyType', 'Tags');
    }
}
