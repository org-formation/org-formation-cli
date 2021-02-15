import { CloudFormationBinder, ICfnBinding } from '~cfn-binder/cfn-binder';
import { OrgResourceTypes } from '~parser/model/resource-types';
import { TemplateRoot } from '~parser/parser';
import { PersistedState } from '~state/persisted-state';
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

    beforeEach(async () => {
        template = await TemplateRoot.create('./test/resources/cloudtrail/cloudtrail.yml');
        const persistedState = PersistedState.CreateEmpty(template.organizationSection.masterAccount.accountId);

        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '000000000000', logicalId: 'MasterAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '111111111111', logicalId: 'SharedUsersAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '222222222222', logicalId: 'SharedServicesAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '333333333333', logicalId: 'SharedComplianceAccount', lastCommittedHash: 'abc'});

        cloudformationBinder = new CloudFormationBinder('cloudtrail', template, persistedState);
        bindings = await cloudformationBinder.enumBindings();
        masterBinding = bindings.find((x) => x.accountId === '000000000000');
        masterCfnTemplate = JSON.parse(masterBinding.template.createTemplateBody()) as ICfnTemplate;
        servicesBinding = bindings.find((x) => x.accountId === '222222222222');
        servicesCfnTemplate = JSON.parse(servicesBinding.template.createTemplateBody()) as ICfnTemplate;
        complianceBinding = bindings.find((x) => x.accountId === '333333333333');
        complianceCfnTemplate = JSON.parse(complianceBinding.template.createTemplateBody()) as ICfnTemplate;
    });
    test('can create cfn bindings for template', () => {
        expect(bindings).toBeDefined();
    });

    test('creates 4 bindings for template', () => {
        expect(bindings.length).toBe(4);
    });

    test('compliance account has s3 bucket', () => {
        const resources = Object.entries(complianceCfnTemplate.Resources).map((x) => x[1]);
        const buckets = resources.filter((x) => x.Type === 'AWS::S3::Bucket');
        expect(buckets.length).toBe(1);

        expect(buckets[0].Properties.BucketName).toBe('cloudtrail-333333333333');
    });

    test('compliance account has export for s3 bucket', () => {
        expect(complianceCfnTemplate.Outputs[expectedOutputLogicalId]).toBeDefined();
        expect(complianceCfnTemplate.Outputs[expectedOutputLogicalId].Export.Name).toBe(expectedExportNameFors3Bucket);

        const refValue = complianceCfnTemplate.Outputs[expectedOutputLogicalId].Value as ICfnRefValue;
        expect(refValue.Ref).toBeDefined();
        expect(refValue.Ref).toBe('CloudTrailS3Bucket');
    });

    test('master account has parameter for s3 bucket', () => {
        expect(masterCfnTemplate.Parameters).toBeDefined();
        const parameter = Object.values(masterCfnTemplate.Parameters)[0];
        expect(parameter.ExportAccountId).toBe('333333333333');
        expect(parameter.ExportName).toBe(expectedExportNameFors3Bucket);
        expect(parameter.ExportRegion).toBe('eu-central-1');
    });

    test('services account has parameter for s3 bucket', () => {
        expect(servicesCfnTemplate.Parameters).toBeDefined();
        const parameter = Object.values(servicesCfnTemplate.Parameters)[0];
        expect(parameter.ExportAccountId).toBe('333333333333');
        expect(parameter.ExportName).toBe(expectedExportNameFors3Bucket);
        expect(parameter.ExportRegion).toBe('eu-central-1');
    });

    test('master account references parameter for cloudtrail s3 bucket', () => {
        expect(masterCfnTemplate.Resources.CloudTrail).toBeDefined();
        const bucketName = masterCfnTemplate.Resources.CloudTrail.Properties.S3BucketName as ICfnRefValue;
        expect(bucketName).toBeDefined();
        expect(bucketName.Ref).toBe(Object.keys(masterCfnTemplate.Parameters)[0]);
    });

    test('services account references parameter for cloudtrail s3 bucket', () => {
        expect(servicesCfnTemplate.Resources.CloudTrail).toBeDefined();
        const bucketName = servicesCfnTemplate.Resources.CloudTrail.Properties.S3BucketName as ICfnRefValue;
        expect(bucketName).toBeDefined();
        expect(bucketName.Ref).toBe(Object.keys(servicesCfnTemplate.Parameters)[0]);
    });
});
