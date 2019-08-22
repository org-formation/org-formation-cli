import { IResource, TemplateRoot } from '../parser';
import { CloudFormationResource } from './cloudformation-resource';
export interface IStackProperties {
    TemplateURL: string;
}
export declare class CloudFormationStackResource extends CloudFormationResource {
    templateUrl: string;
    templateContents: string;
    templateHash: string;
    templateUnresolvable: boolean;
    private props;
    constructor(root: TemplateRoot, id: string, resource: IResource);
    calculateHash(): string;
}
