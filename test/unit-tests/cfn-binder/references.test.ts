import { CloudFormationBinder, ICfnBinding, ICfnGetAttValue, ICfnRefValue, ICfnSubValue } from '~cfn-binder/cfn-binder';
import { OrgResourceTypes } from '~parser/model/resource-types';
import { TemplateRoot } from '~parser/parser';
import { PersistedState } from '~state/persisted-state';
import { ICfnResource, ICfnTemplate } from '../cfn-types';

describe('when loading reference to multiple', () => {
    test('fails with exception', () => {
        const template = TemplateRoot.create('./test/resources/references/reference-to-multiple.yml');
        const persistedState = PersistedState.CreateEmpty(template.organizationSection.masterAccount.accountId);

        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '000000000000', logicalId: 'MasterAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '111111111111', logicalId: 'Account1', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '222222222222', logicalId: 'Account2', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '333333333333', logicalId: 'Account3', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '444444444444', logicalId: 'Account4', lastCommittedHash: 'abc'});

        const cloudformationBinder = new CloudFormationBinder('foreach', template, persistedState);
        expect(() =>  cloudformationBinder.enumBindings()).toThrowError(/Topic/);
        expect(() =>  cloudformationBinder.enumBindings()).toThrowError(/multiple targets/);

    });
});

describe('when loading cross account references through sub', () => {

    let bindings: ICfnBinding[];
    let templateAccount1: ICfnTemplate;
    let templateAccount2: ICfnTemplate;
    let masterAccount: ICfnTemplate;

    beforeEach(() => {
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
    test('can create cfn bindings for template', () => {
        expect(bindings).toBeDefined();
    });

    test('creates 3 bindings for template', () => {
        expect(bindings.length).toBe(3);
    });

    test('master has 1 topic as only resource', () => {
        const keys = Object.keys(masterAccount.Resources);
        expect(keys.length).toBe(1);
        expect(keys[0]).toBe('TopicMaster');
    });

    test('template 1 has topic as first resource', () => {
        const keys = Object.keys(templateAccount1.Resources);
        expect(keys[0]).toBe('Topic');
    });

    test('template 1 has 2 outputs', () => {
        const outputGetAtt = templateAccount1.Outputs.referenceDashusingDashsubDashTopicDashTopicName;
        const outputRef = templateAccount1.Outputs.referenceDashusingDashsubDashTopic;

        expect(outputGetAtt).toBeDefined();
        expect(outputRef).toBeDefined();

        const getatt = (outputGetAtt.Value as ICfnGetAttValue)['Fn::GetAtt'];
        const getref = (outputRef.Value as ICfnRefValue).Ref;

        expect(getatt).toBeDefined();
        expect(getref).toBeDefined();

        expect(outputGetAtt.Export.Name).toBe('reference-using-sub-Topic-TopicName');
        expect(outputRef.Export.Name).toBe('reference-using-sub-Topic');
    });

    test('template 2 has S3 buckets', () => {
        const resourceKeys = Object.keys(templateAccount2.Resources);
        expect(resourceKeys.includes('S3Bucket1')).toBe(true);
        expect(resourceKeys.includes('S3Bucket2')).toBe(true);
        expect(resourceKeys.includes('S3Bucket3')).toBe(true);
        expect(resourceKeys.includes('S3Bucket4')).toBe(true);
        expect(resourceKeys.includes('S3Bucket5')).toBe(true);
        expect(resourceKeys.includes('S3Bucket6')).toBe(true);
        expect(resourceKeys.includes('S3Bucket7')).toBe(true);
        expect(resourceKeys.includes('S3Bucket8')).toBe(true);
    });

    test(
        'Account 2 S3Bucket 1 Bucketname gets rewritten to parameter reference',
        () => {
            const bucketName: ICfnSubValue = templateAccount2.Resources.S3Bucket1.Properties.BucketName;
            expect(bucketName['Fn::Sub']).toBe('${TopicDotTopicName}-bucket');
        }
    );

    test(
        'Account 2 S3Bucket 2 Bucketname gets rewritten to parameter reference',
        () => {
            const bucketName: ICfnSubValue = templateAccount2.Resources.S3Bucket2.Properties.BucketName;
            expect(bucketName['Fn::Sub']).toEqual(expect.not.stringContaining('Account1.Resource'));
            expect(bucketName['Fn::Sub']).toBe('${Account1DotResourcesDotTopicDotTopicName}-bucket');
        }
    );

    test(
        'Account 2 S3Bucket 3 Bucketname gets rewritten to parameter reference',
        () => {
            const bucketName: ICfnSubValue = templateAccount2.Resources.S3Bucket3.Properties.BucketName;
            const refExpression = bucketName['Fn::Sub'][1].var as ICfnRefValue;

            expect(refExpression).toBeDefined();
            expect(refExpression.Ref).toEqual(expect.not.stringContaining('Account1.Resources'));
            expect(refExpression.Ref).toBe('Account1DotResourcesDotTopicDotTopicName');
        }
    );

    test(
        'Account 2 S3Bucket 4 Bucketname gets rewritten to parameter reference',
        () => {
            const bucketName: ICfnSubValue = templateAccount2.Resources.S3Bucket4.Properties.BucketName;
            const refExpression = bucketName['Fn::Sub'][1].var as ICfnRefValue;

            expect(refExpression.Ref).toBe('Topic');
            expect(templateAccount2.Parameters.Topic).toBeDefined();
            expect(templateAccount2.Parameters.Topic.ExportAccountId).toBe('111111111111');
            expect(templateAccount2.Parameters.Topic.ExportName).toBe('reference-using-sub-Topic');
        }
    );

    test(
        'Account 2 S3Bucket 5 Bucketname gets rewritten to local GetAtt reference',
        () => {
            const bucketName: ICfnSubValue = templateAccount2.Resources.S3Bucket5.Properties.BucketName;
            const getAttExpression = bucketName['Fn::Sub'][1].var as ICfnGetAttValue;

            expect(getAttExpression['Fn::GetAtt']).toBeDefined();
            expect(getAttExpression['Fn::GetAtt'][0]).toBe('S3Bucket4');
            expect(getAttExpression['Fn::GetAtt'][1]).toBe('BucketName');
        }
    );

    test(
        'Account 2 S3Bucket 6 Bucketname gets rewritten to local GetAtt reference',
        () => {
            const bucketName: ICfnSubValue = templateAccount2.Resources.S3Bucket6.Properties.BucketName;
            const refExpression = bucketName['Fn::Sub'][1].var as ICfnRefValue;

            expect(refExpression.Ref).toBeDefined();
            expect(refExpression.Ref).toBe('Account1DotResourcesDotTopic');
        }
    );

    test(
        'Account 2 S3Bucket 7 Bucketname gets rewritten to local GetAtt reference',
        () => {
            const bucketName: ICfnSubValue = templateAccount2.Resources.S3Bucket7.Properties.BucketName;
            const getAttExpression = bucketName['Fn::Sub'] as string;

            expect(getAttExpression).toBeDefined();
            expect(getAttExpression).toEqual(expect.stringContaining('S3Bucket6.BucketName'));
            expect(getAttExpression).toEqual(expect.not.stringContaining('Account2'));
        }
    );

    test('Account 2 S3Bucket 9 Bucketname gets rewritten to parameter', () => {
        const bucketName: ICfnSubValue = templateAccount2.Resources.S3Bucket9.Properties.BucketName;
        expect(bucketName['Fn::Sub']).toEqual(expect.not.stringContaining('MasterAccount.Resource'));
        expect(bucketName['Fn::Sub']).toBe('${MasterAccountDotResourcesDotTopicMasterDotTopicName}-bucket');
    });

    test(
        'Account 2 S3Bucket 10 Bucketname gets rewritten to local GetAtt reference',
        () => {
            const bucketName: ICfnSubValue = templateAccount2.Resources.S3Bucket10.Properties.BucketName;
            const refExpression = bucketName['Fn::Sub'][1].var as ICfnRefValue;

            expect(refExpression.Ref).toBeDefined();
            expect(refExpression.Ref).toBe('MasterAccountDotResourcesDotTopicMaster');
        }
    );

    test('Account 2 S3Bucket 11 Bucketname gets rewritten to value', () => {
        const bucketName: ICfnSubValue = templateAccount2.Resources.S3Bucket11.Properties.BucketName;
        const refExpression = bucketName['Fn::Sub'][1].var as ICfnRefValue;

        expect(refExpression).toBeDefined();
        expect(refExpression).toBe('root@mail.com');
    });

    test(
        'Account 1 S3Bucket 12 Attributes to local !Ref using Resources resolves to !Ref',
        () => {
            const val: ICfnRefValue  = templateAccount1.Resources.S3Bucket12.Properties.SameAccountResourcesRef;

            expect(val.Ref).toBeDefined();
            expect(val.Ref).toBe('Topic');
        }
    );
    test(
        'Account 1 S3Bucket 12 Attributes to local !GetAtt using Resources resolves to !GetAtt',
        () => {
            const  val: ICfnGetAttValue  = templateAccount1.Resources.S3Bucket12.Properties.SameAccountResourcesGetAtt;

            expect(val['Fn::GetAtt']).toBeDefined();
            expect(val['Fn::GetAtt'][0]).toBe('Topic');
            expect(val['Fn::GetAtt'][1]).toBe('Arn');
        }
    );
    test(
        'Account 1 S3Bucket 12 Attributes to local !Sub using Resources resolves to !Sub',
        () => {
            const val: ICfnSubValue  = templateAccount1.Resources.S3Bucket12.Properties.SameAccountResourcesSubRef;

            expect(val['Fn::Sub']).toBeDefined();
            expect(val['Fn::Sub']).toEqual(expect.stringContaining('${Topic}'));
        }
    );
    test(
        'Account 1 S3Bucket 12 Attributes to local !Sub using Resources resolves to !Sub with path',
        () => {
            const val: ICfnSubValue  = templateAccount1.Resources.S3Bucket12.Properties.SameAccountResourcesSubGetAtt;

            expect(val['Fn::Sub']).toBeDefined();
            expect(val['Fn::Sub']).toEqual(expect.stringContaining('${Topic.Arn}'));
        }
    );

    test(
        'Account 1 S3Bucket 13 Attributes to AWSAccount !Ref using Resources resolves to !Ref',
        () => {
            const val: ICfnRefValue  = templateAccount1.Resources.S3Bucket13.Properties.AWSAccountResourcesRef;

            expect(val.Ref).toBeDefined();
            expect(val.Ref).toBe('Topic');
        }
    );

    test(
        'Account 1 S3Bucket 13 Attributes to AWSAccount !GetAtt using Resources resolves to !GetAtt',
        () => {
            const  val: ICfnGetAttValue  = templateAccount1.Resources.S3Bucket13.Properties.AWSAccountResourcesGetAtt;

            expect(val['Fn::GetAtt']).toBeDefined();
            expect(val['Fn::GetAtt'][0]).toBe('Topic');
            expect(val['Fn::GetAtt'][1]).toBe('Arn');
        }
    );

    test(
        'Account 1 S3Bucket 13 Attributes to AWSAccount !Sub using Resources resolves to !Sub',
        () => {
            const val: ICfnSubValue  = templateAccount1.Resources.S3Bucket13.Properties.AWSAccountResourcesSubRef;

            expect(val['Fn::Sub']).toBeDefined();
            expect(val['Fn::Sub']).toEqual(expect.stringContaining('${Topic}'));
        }
    );

    test(
        'Account 1 S3Bucket 13 Attributes to AWSAccount !Sub using Resources resolves to !Sub with path',
        () => {
            const val: ICfnSubValue  = templateAccount1.Resources.S3Bucket13.Properties.AWSAccountResourcesSubGetAtt;

            expect(val['Fn::Sub']).toBeDefined();
            expect(val['Fn::Sub']).toEqual(expect.stringContaining('${Topic.Arn}'));
        }
    );

    test(
        'Account 2 S3Bucket 14 Attributes to other account !Ref using Resources resolves to !Ref',
        () => {
            const val: ICfnRefValue  = templateAccount2.Resources.S3Bucket14.Properties.OtherAccountResourcesRef;

            expect(val.Ref).toBeDefined();
            expect(val.Ref).toBe('Account1DotResourcesDotTopic');

            expect(templateAccount2.Parameters.Account1DotResourcesDotTopic).toBeDefined();
            expect(templateAccount2.Parameters.Account1DotResourcesDotTopic.ExportAccountId).toBe('111111111111');
        }
    );

    test(
        'Account 2 S3Bucket 14 Attributes to other account !GetAtt using Resources resolves to !GetAtt',
        () => {
            const  val: ICfnRefValue  = templateAccount2.Resources.S3Bucket14.Properties.OtherAccountResourcesGetAtt;

            expect(val.Ref).toBeDefined();
            expect(val.Ref).toBe('Account1DotResourcesDotTopicDotArn');

            expect(templateAccount2.Parameters.Account1DotResourcesDotTopicDotArn).toBeDefined();
            expect(templateAccount2.Parameters.Account1DotResourcesDotTopicDotArn.ExportAccountId).toBe('111111111111');
        }
    );

    test(
        'Account 2 S3Bucket 14 Attributes to other account !Sub using Resources resolves to !Sub',
        () => {
            const val: ICfnSubValue  = templateAccount2.Resources.S3Bucket14.Properties.OtherAccountResourcesSubRef;

            expect(val['Fn::Sub']).toBeDefined();
            expect(val['Fn::Sub']).toEqual(expect.stringContaining('${Account1DotResourcesDotTopic}'));
        }
    );

    test(
        'Account 2 S3Bucket 14 Attributes to other account !Sub using Resources resolves to !Sub with path',
        () => {
            const val: ICfnSubValue  = templateAccount2.Resources.S3Bucket14.Properties.OtherAccountResourcesSubGetAtt;

            expect(val['Fn::Sub']).toBeDefined();
            expect(val['Fn::Sub']).toEqual(expect.stringContaining('${Account1DotResourcesDotTopicDotArn}'));
        }
    );
});

describe('when loading reference to account in param', () => {
    test('resolved account id', () => {
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
        expect(cfnTemplate).toBeDefined();
        expect(cfnTemplate.Parameters.masterAccountId.Default).toBe('000000000000');
    });
});
