import { expect } from 'chai';
import { CloudFormationBinder, ICfnBinding, ICfnGetAttValue, ICfnRefValue, ICfnSubValue } from '../../../src/cfn-binder/cfn-binder';
import { OrgResourceTypes } from '../../../src/parser/model/resource-types';
import { TemplateRoot } from '../../../src/parser/parser';
import { PersistedState } from '../../../src/state/persisted-state';
import { ICfnResource, ICfnTemplate } from '../cfn-types';

describe('when loading reference to multiple', () => {
    it ('fails with exception', () => {
        const template = TemplateRoot.create('./test/resources/references/reference-to-multiple.yml');
        const persistedState = PersistedState.CreateEmpty(template.organizationSection.masterAccount.accountId);

        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '000000000000', logicalId: 'MasterAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '111111111111', logicalId: 'Account1', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '222222222222', logicalId: 'Account2', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '333333333333', logicalId: 'Account3', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '444444444444', logicalId: 'Account4', lastCommittedHash: 'abc'});

        const cloudformationBinder = new CloudFormationBinder('foreach', template, persistedState);
        expect(() =>  cloudformationBinder.enumBindings()).to.throw(/Topic/);
        expect(() =>  cloudformationBinder.enumBindings()).to.throw(/multiple targets/);

    });
});

describe('when loading cross account references through sub', () => {

    let bindings: ICfnBinding[];
    let templateAccount1: ICfnTemplate;
    let templateAccount2: ICfnTemplate;
    let masterAccount: ICfnTemplate;

    beforeEach (() => {
        const template = TemplateRoot.create('./test/resources/references/reference-using-sub.yml');
        const persistedState = PersistedState.CreateEmpty(template.organizationSection.masterAccount.accountId);

        persistedState.setBinding({type: OrgResourceTypes.MasterAccount, physicalId: '000000000000', logicalId: 'MasterAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '111111111111', logicalId: 'Account1', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '222222222222', logicalId: 'Account2', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '333333333333', logicalId: 'Account3', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '444444444444', logicalId: 'Account4', lastCommittedHash: 'abc'});

        const cloudformationBinder = new CloudFormationBinder('reference-using-sub', template, persistedState);
        bindings = cloudformationBinder.enumBindings();

        masterAccount = JSON.parse(bindings.find((x) => x.accountId === '000000000000').template.createTemplateBody());
        templateAccount1 = JSON.parse(bindings.find((x) => x.accountId === '111111111111').template.createTemplateBody());
        templateAccount2 = JSON.parse(bindings.find((x) => x.accountId === '222222222222').template.createTemplateBody());
    });
    it('can create cfn bindings for template', () => {
        expect(bindings).to.not.be.undefined;
    });

    it('creates 3 bindings for template', () => {
        expect(bindings.length).to.eq(3);
    });

    it('master has 1 topic as only resource', () => {
        const keys = Object.keys(masterAccount.Resources);
        expect(keys.length).to.eq(1);
        expect(keys[0]).to.eq('TopicMaster');
    });

    it('template 1 has topic as only resource', () => {
        const keys = Object.keys(templateAccount1.Resources);
        expect(keys.length).to.eq(1);
        expect(keys[0]).to.eq('Topic');
    });

    it('template 1 has 2 outputs', () => {
        const outputGetAtt = templateAccount1.Outputs.referenceDashusingDashsubDashTopicDashTopicName;
        const outputRef = templateAccount1.Outputs.referenceDashusingDashsubDashTopic;

        expect(outputGetAtt).to.not.be.undefined;
        expect(outputRef).to.not.be.undefined;

        const getatt = (outputGetAtt.Value as ICfnGetAttValue)['Fn::GetAtt'];
        const getref = (outputRef.Value as ICfnRefValue).Ref;

        expect(getatt).to.not.be.undefined;
        expect(getref).to.not.be.undefined;

        expect(outputGetAtt.Export.Name).to.eq('reference-using-sub-Topic-TopicName');
        expect(outputRef.Export.Name).to.eq('reference-using-sub-Topic');
    });

    it('template 2 has S3 buckets', () => {
        const resourceKeys = Object.keys(templateAccount2.Resources);
        expect(resourceKeys.includes('S3Bucket1')).to.be.true;
        expect(resourceKeys.includes('S3Bucket2')).to.be.true;
        expect(resourceKeys.includes('S3Bucket3')).to.be.true;
        expect(resourceKeys.includes('S3Bucket4')).to.be.true;
        expect(resourceKeys.includes('S3Bucket5')).to.be.true;
        expect(resourceKeys.includes('S3Bucket6')).to.be.true;
        expect(resourceKeys.includes('S3Bucket7')).to.be.true;
        expect(resourceKeys.includes('S3Bucket8')).to.be.true;
    });

    it('Account 2 S3Bucket 1 Bucketname gets rewritten to parameter reference', () => {
        const bucketName: ICfnSubValue = templateAccount2.Resources.S3Bucket1.Properties.BucketName;
        expect(bucketName['Fn::Sub']).to.eq('${TopicDotTopicName}-bucket');
    });

    it('Account 2 S3Bucket 2 Bucketname gets rewritten to parameter reference', () => {
        const bucketName: ICfnSubValue = templateAccount2.Resources.S3Bucket2.Properties.BucketName;
        expect(bucketName['Fn::Sub']).to.not.contain('Account1.Resource');
        expect(bucketName['Fn::Sub']).to.eq('${TopicDotTopicName}-bucket');
    });

    it('Account 2 S3Bucket 3 Bucketname gets rewritten to parameter reference', () => {
        const bucketName: ICfnSubValue = templateAccount2.Resources.S3Bucket3.Properties.BucketName;
        const refExpression = bucketName['Fn::Sub'][1].var as ICfnRefValue;

        expect(refExpression).to.not.undefined;
        expect(refExpression.Ref).to.not.contain('Account1.Resources');
        expect(refExpression.Ref).to.eq('Account1DotResourcesDotTopicDotTopicName');
    });

    it('Account 2 S3Bucket 4 Bucketname gets rewritten to parameter reference', () => {
        const bucketName: ICfnSubValue = templateAccount2.Resources.S3Bucket4.Properties.BucketName;
        const refExpression = bucketName['Fn::Sub'][1].var as ICfnRefValue;

        expect(refExpression.Ref).to.eq('Topic');
        expect(templateAccount2.Parameters.Topic).to.not.be.undefined;
        expect(templateAccount2.Parameters.Topic.ExportAccountId).to.eq('111111111111');
        expect(templateAccount2.Parameters.Topic.ExportName).to.eq('reference-using-sub-Topic');
    });

    it('Account 2 S3Bucket 5 Bucketname gets rewritten to local GetAtt reference', () => {
        const bucketName: ICfnSubValue = templateAccount2.Resources.S3Bucket5.Properties.BucketName;
        const getAttExpression = bucketName['Fn::Sub'][1].var as ICfnGetAttValue;

        expect(getAttExpression['Fn::GetAtt']).to.not.be.undefined;
        expect(getAttExpression['Fn::GetAtt'][0]).to.eq('S3Bucket4');
        expect(getAttExpression['Fn::GetAtt'][1]).to.eq('BucketName');
    });

    it('Account 2 S3Bucket 6 Bucketname gets rewritten to local GetAtt reference', () => {
        const bucketName: ICfnSubValue = templateAccount2.Resources.S3Bucket6.Properties.BucketName;
        const refExpression = bucketName['Fn::Sub'][1].var as ICfnRefValue;

        expect(refExpression.Ref).to.not.be.undefined;
        expect(refExpression.Ref).to.eq('Topic');
    });

    it('Account 2 S3Bucket 7 Bucketname gets rewritten to local GetAtt reference', () => {
        const bucketName: ICfnSubValue = templateAccount2.Resources.S3Bucket7.Properties.BucketName;
        const getAttExpression = bucketName['Fn::Sub'] as string;

        expect(getAttExpression).to.not.be.undefined;
        expect(getAttExpression).to.contain('S3Bucket6.BucketName');
        expect(getAttExpression).to.not.contain('Account2');
    });

    it('Account 2 S3Bucket 9 Bucketname gets rewritten to parameter', () => {
        const bucketName: ICfnSubValue = templateAccount2.Resources.S3Bucket9.Properties.BucketName;
        expect(bucketName['Fn::Sub']).to.not.contain('MasterAccount.Resource');
        expect(bucketName['Fn::Sub']).to.eq('${TopicMasterDotTopicName}-bucket');
    });

    it('Account 2 S3Bucket 10 Bucketname gets rewritten to local GetAtt reference', () => {
        const bucketName: ICfnSubValue = templateAccount2.Resources.S3Bucket10.Properties.BucketName;
        const refExpression = bucketName['Fn::Sub'][1].var as ICfnRefValue;

        expect(refExpression.Ref).to.not.be.undefined;
        expect(refExpression.Ref).to.eq('TopicMaster');
    });

    it('Account 2 S3Bucket 11 Bucketname gets rewritten to value', () => {
        const bucketName: ICfnSubValue = templateAccount2.Resources.S3Bucket11.Properties.BucketName;
        const refExpression = bucketName['Fn::Sub'][1].var as ICfnRefValue;

        expect(refExpression).to.not.be.undefined;
        expect(refExpression).to.eq('root@mail.com');
    });
});

describe('when loading reference to account in param', () => {
    it ('resolved account id', () => {
        const template = TemplateRoot.create('./test/resources/references/reference-to-account-in-param.yml');
        const persistedState = PersistedState.CreateEmpty(template.organizationSection.masterAccount.accountId);

        persistedState.setBinding({type: OrgResourceTypes.MasterAccount, physicalId: '000000000000', logicalId: 'MasterAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '111111111111', logicalId: 'Account1', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '222222222222', logicalId: 'Account2', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '333333333333', logicalId: 'Account3', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '444444444444', logicalId: 'Account4', lastCommittedHash: 'abc'});

        const cloudformationBinder = new CloudFormationBinder('references', template, persistedState);
        const binding = cloudformationBinder.enumBindings()[0];
        const cfnTemplate = JSON.parse(binding.template.createTemplateBody());
        expect(cfnTemplate).to.not.be.undefined;
        expect(cfnTemplate.Parameters.masterAccountId.Default).to.eq('000000000000');
    });
});
