import { IResource, TemplateRoot } from '../parser';
import { Resource } from './resource';

export interface IServiceControlPolicyProperties {
    PolicyName: string;
    Description?: string;
    PolicyDocument: any;
    Tags?: Record<string, string>;
}
export class ServiceControlPolicyResource extends Resource {
    public policyName: string;
    public description: string;
    public policyDocument: any;
    public tags: Record<string, string>;
    constructor(root: TemplateRoot, id: string, resource: IResource) {
        super(root, id, resource);

        const props = this.resource.Properties as IServiceControlPolicyProperties;

        if (!props.PolicyName) {
            throw new Error(`PolicyName is missing on Service Control Policy ${id}`);
        }

        if (!props.PolicyDocument) {
            throw new Error(`PolicyDocument is missing on Service Control Policy ${id}`);
        }

        this.policyName = props.PolicyName;
        this.description = props.Description;
        this.policyDocument = props.PolicyDocument;
        this.tags = props.Tags;

        super.throwForUnknownAttributes(props, id, 'PolicyName', 'Description', 'PolicyDocument', 'Tags' );
    }
}
