import { OrgFormationError } from '../../org-formation-error';
import { IResource, TemplateRoot } from '../parser';
import { AccountResource } from './account-resource';
import { ConsoleUtil } from '~util/console-util';

export class MasterAccountResource extends AccountResource {

    constructor(root: TemplateRoot, id: string, resource: IResource) {
        super(root, id, resource);
        if (this.supportLevel) {
            throw new OrgFormationError('specifying SupportLevel on a MasterAccount resource is not supported, a support level must be subscribed to in the console.');
        }
        if (!this.accountId) {
            throw new OrgFormationError(`AccountId is missing on MasterAccount ${id}`);
        }
        if (this.serviceControlPolicies.length) {
            ConsoleUtil.LogWarning('ServiceControlPolicies can be attached on your MasterAccount, though SCPs don\'t affect users or roles in the management account. see: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html#');
        }
    }

}
