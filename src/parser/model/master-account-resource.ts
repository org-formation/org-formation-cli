import { IResource, IResourceRef, TemplateRoot } from '../parser';
import { AccountResource } from './account-resource';

export class MasterAccountResource extends AccountResource {

    constructor(root: TemplateRoot, id: string, resource: IResource) {
        super(root, id, resource);
    }

}
