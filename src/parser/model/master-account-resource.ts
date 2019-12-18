import { OrgFormationError } from '../../org-formation-error';
import { IResource, IResourceRef, TemplateRoot } from '../parser';
import { AccountResource } from './account-resource';

export class MasterAccountResource extends AccountResource {

    constructor(root: TemplateRoot, id: string, resource: IResource) {
        super(root, id, resource);

        if (!this.accountId) {
            throw new OrgFormationError(`AccountId is missing on MasterAccount ${id}`);
        }
    }

}
