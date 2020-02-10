import { AwsOrganization } from '../../src/aws-provider/aws-organization';
import { AWSAccount } from '../../src/aws-provider/aws-organization-reader';

export class TestOrganizations {
    public static createBasicOrganization(): AwsOrganization {
        const organizationModel = new AwsOrganization(undefined);
        organizationModel.accounts = [{Id: '123456789012', ParentId: 'org-root-id', Policies: [], Type : 'Account', Name: 'Account Name', Tags: {tag1: 'val1'}} as unknown as AWSAccount];
        organizationModel.roots = [{Id: 'org-root-id', Policies: []}];
        organizationModel.masterAccount = { Id : '00000000000000', ParentId: 'org-root-id', Policies: [], Type : 'Account', Name: 'Organizational Master Account' } as AWSAccount;
        organizationModel.organization = {Id: 'org-id'};
        organizationModel.organizationalUnits = [];
        return organizationModel;
    }
}
