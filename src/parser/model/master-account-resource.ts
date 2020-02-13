import { OrgFormationError } from '../../org-formation-error';
import { IResource, IResourceRef, TemplateRoot } from '../parser';
import { AccountResource } from './account-resource';

export class MasterAccountResource extends AccountResource {

    constructor(root: TemplateRoot, id: string, resource: IResource) {
        super(root, id, resource);
        if (this.supportLevel) {
            throw new OrgFormationError('specifying SupportLevel on a MasterAccount resource is not supported, a support level must be subscribed to in the console.');
        }
        if (!this.accountId) {
            throw new OrgFormationError(`AccountId is missing on MasterAccount ${id}`);
        }
    }

}
