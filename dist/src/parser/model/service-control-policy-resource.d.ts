import { IResource, TemplateRoot } from '../parser';
import { Resource } from './resource';
export interface IServiceControlPolicyProperties {
    PolicyName: string;
    Description?: string;
    PolicyDocument: any;
}
export declare class ServiceControlPolicyResource extends Resource {
    policyName: string;
    description: string;
    policyDocument: any;
    constructor(root: TemplateRoot, id: string, resource: IResource);
}
