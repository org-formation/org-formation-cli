import { IResource, TemplateRoot } from '../parser';
import { Resource } from './resource';

export class CloudFormationStackResource extends Resource {

    constructor(root: TemplateRoot, id: string, resource: IResource) {
        super(root, id, resource);

    }
}
