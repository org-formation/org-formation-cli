import * as AWS from 'aws-sdk';
import * as AWSMock from 'aws-sdk-mock';
import { CreateOrganizationalUnitRequest } from 'aws-sdk/clients/organizations';
import { expect } from 'chai';
import * as Sinon from 'sinon';
import { AwsOrganization } from '../../../src/aws-provider/aws-organization';
import { AwsOrganizationWriter } from '../../../src/aws-provider/aws-organization-writer';
import { TestOrganizations } from '../test-organizations';

describe('when creating a new organizational unit using writer', () => {
    let organizationService: AWS.Organizations;
    let organizationModel: AwsOrganization;
    let writer: AwsOrganizationWriter;
    let createOrganizationalUnitSpy: Sinon.SinonSpy;
    const ou = { organizationalUnitName: 'new-ou', accounts: [{Ref: '123456789012'}] };
    const ouId = 'new-ou';

    beforeEach(async () => {
        AWSMock.setSDKInstance(AWS);

        AWSMock.mock('Organizations', 'createOrganizationalUnit', (params: any, callback: any) => { callback(null, {OrganizationalUnit: { Id: ouId}}); });

        organizationService = new AWS.Organizations();
        organizationModel = TestOrganizations.createBasicOrganization();

        createOrganizationalUnitSpy = organizationService.createOrganizationalUnit as Sinon.SinonSpy;

        writer = new AwsOrganizationWriter(organizationService, organizationModel);
        await writer.createOrganizationalUnit(ou as any);
    });

    afterEach(() => {
        AWSMock.restore();
    });

    it('organization create organizational unit is called', () => {
        expect(createOrganizationalUnitSpy.callCount).to.eq(1);
    });

    it('organization create organizational unit was passed the right arguments', () => {
        const args: CreateOrganizationalUnitRequest = createOrganizationalUnitSpy.lastCall.args[0];
        expect(args.Name).to.eq(ou.organizationalUnitName);
        expect(args.ParentId).to.eq(organizationModel.roots[0].Id);
    });

    it('organizational unit is added to organization model', () => {
        const ouFromModel = organizationModel.organizationalUnits.find((x) => x.Id === ouId);
        expect(ouFromModel).to.not.be.undefined;
        expect(ouFromModel.Name).to.eq(ou.organizationalUnitName);
        expect(ouFromModel.Id).to.eq(ouId);
    });
});
