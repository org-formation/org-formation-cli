import { IResource, TemplateRoot } from '../parser';
import { Resource } from './resource';

export interface IServiceControlPolicyProperties {
    PolicyName: string;
    Description: string;
    PolicyDocument: any;
}
export class ServiceControlPolicyResource extends Resource {
    public policyName: string;
    public description: string;
    public policyDocument: any;

    constructor(root: TemplateRoot, id: string, resource: IResource) {
        super(root, id, resource);

        const props = this.resource.Properties as IServiceControlPolicyProperties;

        this.policyName = props.PolicyName;
        this.description = props.Description;
        this.policyDocument = props.PolicyDocument;
    }
}
