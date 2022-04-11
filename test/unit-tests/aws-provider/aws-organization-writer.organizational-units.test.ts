import * as AWS from 'aws-sdk';
import * as AWSMock from 'aws-sdk-mock';
import { CreateOrganizationalUnitRequest } from 'aws-sdk/clients/organizations';
import { AwsOrganization } from '~aws-provider/aws-organization';
import { AwsOrganizationWriter } from '~aws-provider/aws-organization-writer';
import { TestOrganizations } from '../test-organizations';

AWSMock.setSDKInstance(AWS);

describe('when creating a new organizational unit using writer', () => {
    let organizationService: AWS.Organizations;
    let organizationModel: AwsOrganization;
    let writer: AwsOrganizationWriter;
    let createOrganizationalUnitSpy: jest.SpyInstance;
    const ou = { organizationalUnitName: 'new-ou', accounts: [{Ref: '123456789012'}] };
    const ouId = 'new-ou';

    beforeEach(async () => {
        AWSMock.mock('Organizations', 'createOrganizationalUnit', (params: any, callback: any) => { callback(null, {OrganizationalUnit: { Id: ouId}}); });

        organizationService = new AWS.Organizations();
        organizationModel = TestOrganizations.createBasicOrganization();

        createOrganizationalUnitSpy = jest.spyOn(organizationService, 'createOrganizationalUnit');

        writer = new AwsOrganizationWriter(organizationService, organizationModel);
        await writer.createOrganizationalUnit(false, ou as any);
    });

    afterEach(() => {
        AWSMock.restore();
    });

    test('organization create organizational unit is called', () => {
        expect(createOrganizationalUnitSpy).toHaveBeenCalledTimes(1);
    });

    test('organization create organizational unit was passed the right arguments', () => {
        const args: CreateOrganizationalUnitRequest = createOrganizationalUnitSpy.mock.calls[0][0];
        expect(args.Name).toBe(ou.organizationalUnitName);
        expect(args.ParentId).toBe(organizationModel.roots[0].Id);
    });

    test('organizational unit is added to organization model', () => {
        const ouFromModel = organizationModel.organizationalUnits.find((x) => x.Id === ouId);
        expect(ouFromModel).toBeDefined();
        expect(ouFromModel.Name).toBe(ou.organizationalUnitName);
        expect(ouFromModel.Id).toBe(ouId);
    });
});
