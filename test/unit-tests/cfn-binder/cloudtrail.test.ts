import { expect } from 'chai';
import { CloudFormationBinder, ICfnBinding } from '../../../src/cfn-binder/cfn-binder';
import { OrgResourceTypes } from '../../../src/parser/model/resource-types';
import { TemplateRoot } from '../../../src/parser/parser';
import { PersistedState } from '../../../src/state/persisted-state';
import { ICfnRefValue, ICfnTemplate } from '../cfn-types';

describe('when loading cloudtrail template', () => {
    let template: TemplateRoot;
    let cloudformationBinder: CloudFormationBinder;
    let bindings: ICfnBinding[];
    let masterBinding: ICfnBinding;
    let masterCfnTemplate: ICfnTemplate;
    let servicesBinding: ICfnBinding;
    let servicesCfnTemplate: ICfnTemplate;
    let complianceBinding: ICfnBinding;
    let complianceCfnTemplate: ICfnTemplate;
    const expectedExportNameFors3Bucket = 'cloudtrail-CloudTrailS3Bucket';
    const expectedOutputLogicalId = 'cloudtrailDashCloudTrailS3Bucket';

    beforeEach(() => {
        template = TemplateRoot.create('./test/resources/cloudtrail/cloudtrail.yml');
        const persistedState = PersistedState.CreateEmpty(template.organizationSection.masterAccount.accountId);

        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '0', logicalId: 'MasterAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '1', logicalId: 'SharedUsersAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '2', logicalId: 'SharedServicesAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '3', logicalId: 'SharedComplianceAccount', lastCommittedHash: 'abc'});

        cloudformationBinder = new CloudFormationBinder('cloudtrail', template, persistedState);
        bindings = cloudformationBinder.enumBindings();
        masterBinding = bindings.find((x) => x.accountId === '0');
        masterCfnTemplate = JSON.parse(masterBinding.template.createTemplateBody()) as ICfnTemplate;
        servicesBinding = bindings.find((x) => x.accountId === '2');
        servicesCfnTemplate = JSON.parse(servicesBinding.template.createTemplateBody()) as ICfnTemplate;
        complianceBinding = bindings.find((x) => x.accountId === '3');
        complianceCfnTemplate = JSON.parse(complianceBinding.template.createTemplateBody()) as ICfnTemplate;
    });
    it('can create cfn bindings for template', () => {
        expect(bindings).to.not.be.undefined;
    });

    it('creates 4 bindings for template', () => {
        expect(bindings.length).to.eq(4);
    });

    it('compliance account has s3 bucket', () => {
        const resources = Object.entries(complianceCfnTemplate.Resources).map((x) => x[1]);
        const buckets = resources.filter((x) => x.Type === 'AWS::S3::Bucket');
        expect(buckets.length).to.eq(1);

        expect(buckets[0].Properties.BucketName).to.eq('cloudtrail-3');
    });

    it('compliance account has export for s3 bucket', () => {
        expect(complianceCfnTemplate.Outputs[expectedOutputLogicalId]).to.not.be.undefined;
        expect(complianceCfnTemplate.Outputs[expectedOutputLogicalId].Export.Name).to.eq(expectedExportNameFors3Bucket);

        const refValue = complianceCfnTemplate.Outputs[expectedOutputLogicalId].Value as ICfnRefValue;
        expect(refValue.Ref).to.not.be.undefined;
        expect(refValue.Ref).to.eq('CloudTrailS3Bucket');
    });

    it('master account has parameter for s3 bucket', () => {
        expect(masterCfnTemplate.Parameters).to.not.be.undefined;
        const parameter = Object.values(masterCfnTemplate.Parameters)[0];
        expect(parameter.ExportAccountId).to.eq('3');
        expect(parameter.ExportName).to.eq(expectedExportNameFors3Bucket);
        expect(parameter.ExportRegion).to.eq('eu-central-1');
    });

    it('services account has parameter for s3 bucket', () => {
        expect(servicesCfnTemplate.Parameters).to.not.be.undefined;
        const parameter = Object.values(servicesCfnTemplate.Parameters)[0];
        expect(parameter.ExportAccountId).to.eq('3');
        expect(parameter.ExportName).to.eq(expectedExportNameFors3Bucket);
        expect(parameter.ExportRegion).to.eq('eu-central-1');
    });

    it('master account references parameter for cloudtrail s3 bucket', () => {
        expect(masterCfnTemplate.Resources.CloudTrail).to.not.be.undefined;
        const bucketName = masterCfnTemplate.Resources.CloudTrail.Properties.S3BucketName as ICfnRefValue;
        expect(bucketName).to.not.be.undefined;
        expect(bucketName.Ref).to.eq(Object.keys(masterCfnTemplate.Parameters)[0]);
    });

    it('services account references parameter for cloudtrail s3 bucket', () => {
        expect(servicesCfnTemplate.Resources.CloudTrail).to.not.be.undefined;
        const bucketName = servicesCfnTemplate.Resources.CloudTrail.Properties.S3BucketName as ICfnRefValue;
        expect(bucketName).to.not.be.undefined;
        expect(bucketName.Ref).to.eq(Object.keys(servicesCfnTemplate.Parameters)[0]);
    });
});
