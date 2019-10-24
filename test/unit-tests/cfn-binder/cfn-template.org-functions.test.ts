import * as chai from 'chai';
import { expect } from 'chai';
import { CfnTemplate } from '../../../src/cfn-binder/cfn-template';
import { AccountResource } from '../../../src/parser/model/account-resource';
import { CloudFormationResource } from '../../../src/parser/model/cloudformation-resource';
import { OrgResourceTypes } from '../../../src/parser/model/resource-types';
import { IResourceTarget } from '../../../src/parser/model/resources-section';
import { TemplateRoot } from '../../../src/parser/parser';
import { PersistedState } from '../../../src/state/persisted-state';
import { TestTemplates } from '../test-templates';

chai.use(require('chai-as-promised'));

describe('when using Ref on account', () => {
    let template: CfnTemplate;
    let templateRoot: TemplateRoot;
    let persistedState: PersistedState;
    let target: IResourceTarget;
    let templateResource: any;

    let masterAccountId;
    const otherAccountId = '22332233223322';

    beforeEach(async () => {
        templateRoot = TestTemplates.createBasicTemplate();
        const masterAccountLogicalId = templateRoot.organizationSection.masterAccount.logicalId;
        masterAccountId = templateRoot.organizationSection.masterAccount.accountId;

        const otherAccountLogicalId = templateRoot.organizationSection.accounts[1].logicalId;

        persistedState = PersistedState.CreateEmpty(masterAccountId);
        persistedState.setBinding({ type: OrgResourceTypes.MasterAccount, logicalId: masterAccountLogicalId, physicalId: masterAccountId, lastCommittedHash: '' });
        persistedState.setBinding({ type: OrgResourceTypes.Account, logicalId: otherAccountLogicalId, physicalId: otherAccountId, lastCommittedHash: '' });

        target = {
            region: 'eu-central-1',
            accountLogicalId: templateRoot.organizationSection.accounts[0].logicalId,
            resources: [
                new CloudFormationResource(templateRoot, 'resource',
                    {
                        Type: 'AWS::Custom',
                        Properties: {
                            MasterAccountRef: { Ref : masterAccountLogicalId },
                            OtherAccountRef: { Ref : otherAccountLogicalId },
                            NonAccountRef: { Ref : 'something' },
                        },
                    }),
            ],
        };

        template = new CfnTemplate(target, templateRoot, persistedState);
        const templateForTarget = JSON.parse(template.createTemplateBody());
        templateResource = templateForTarget.Resources.resource;
    });

    it('Ref resolves to physical id for master account', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.MasterAccountRef).to.eq(masterAccountId);
    });

    it('Ref resolves to physical id for regular account', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.OtherAccountRef).to.eq(otherAccountId);
    });

    it('Ref does not change if logicalId is not an account', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.NonAccountRef.Ref).to.not.be.undefined;
        expect(templateResource.Properties.NonAccountRef.Ref).to.eq('something');
    });
});

describe('when using GetAtt on account', () => {
    let template: CfnTemplate;
    let templateRoot: TemplateRoot;
    let persistedState: PersistedState;
    let target: IResourceTarget;
    let templateResource: any;

    let targetAccount: AccountResource;
    let masterAccount: AccountResource;
    let otherAccount: AccountResource;
    const otherAccountId = '12332233223322';
    const targetAccountId = '22332233223322';
    let masterAccountId;

    beforeEach(async () => {
        templateRoot = TestTemplates.createBasicTemplate();
        masterAccount = templateRoot.organizationSection.masterAccount;
        otherAccount = templateRoot.organizationSection.accounts[1];
        targetAccount = templateRoot.organizationSection.accounts[0];

        const masterAccountLogicalId = masterAccount.logicalId;
        masterAccountId = masterAccount.accountId;

        const otherAccountLogicalId = otherAccount.logicalId;

        persistedState = PersistedState.CreateEmpty(masterAccountId);
        persistedState.setBinding({ type: OrgResourceTypes.MasterAccount, logicalId: masterAccountLogicalId, physicalId: masterAccountId, lastCommittedHash: '' });
        persistedState.setBinding({ type: OrgResourceTypes.Account, logicalId: otherAccountLogicalId, physicalId: otherAccountId, lastCommittedHash: '' });
        persistedState.setBinding({ type: OrgResourceTypes.Account, logicalId: targetAccount.logicalId, physicalId: targetAccountId, lastCommittedHash: '' });

        target = {
            region: 'eu-central-1',
            accountLogicalId: targetAccount.logicalId,
            resources: [
                new CloudFormationResource(templateRoot, 'resource',
                    {
                        Type: 'AWS::FantasyType',
                        Properties: {
                            CurrentAccountName: { 'Fn::GetAtt' : ['AWSAccount', 'AccountName'] },
                            CurrentAccountId: { 'Fn::GetAtt' : ['AWSAccount', 'AccountId'] },
                            CurrentRootEmail: { 'Fn::GetAtt' : ['AWSAccount', 'RootEmail'] },
                            CurrentTag: { 'Fn::GetAtt' : ['AWSAccount', 'Tags.key'] },
                            MasterAccountName: { 'Fn::GetAtt' : [masterAccountLogicalId, 'AccountName'] },
                            MasterAccountId: { 'Fn::GetAtt' : [masterAccountLogicalId, 'AccountId'] },
                            MasterRootEmail: { 'Fn::GetAtt' : [masterAccountLogicalId, 'RootEmail'] },
                            MasterTag: { 'Fn::GetAtt' : [masterAccountLogicalId, 'Tags.key'] },
                            OtherAccountName: { 'Fn::GetAtt' : [otherAccountLogicalId, 'AccountName'] },
                            OtherAccountId: { 'Fn::GetAtt' : [otherAccountLogicalId, 'AccountId'] },
                            OtherRootEmail: { 'Fn::GetAtt' : [otherAccountLogicalId, 'RootEmail'] },
                            OtherAlias: { 'Fn::GetAtt' : [otherAccountLogicalId, 'Alias'] },
                            OtherTag: { 'Fn::GetAtt' : [otherAccountLogicalId, 'Tags.key'] },
                        },
                    }),
            ],
        };
        template = new CfnTemplate(target, templateRoot, persistedState);
        const templateForTarget = JSON.parse(template.createTemplateBody());
        templateResource = templateForTarget.Resources.resource;
    });

    it('GetAtt can resolve account name of current account', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.CurrentAccountName).to.eq(targetAccount.accountName);
    });

    it('GetAtt can resolve account id of current account', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.CurrentAccountId).to.eq(targetAccountId);
    });

    it('GetAtt can resolve account root email of current account', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.CurrentRootEmail).to.eq(targetAccount.rootEmail);
    });

    it('GetAtt can resolve account tags of current account', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.CurrentTag).to.eq(targetAccount.tags.key);
    });

    it('GetAtt can resolve account name of master account', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.MasterAccountName).to.eq(masterAccount.accountName);
    });

    it('GetAtt can resolve account id of master account', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.MasterAccountId).to.eq(masterAccountId);
    });

    it('GetAtt can resolve account root email of master account', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.MasterRootEmail).to.eq(masterAccount.rootEmail);
    });

    it('GetAtt can resolve account tags of master account', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.MasterTag).to.eq(masterAccount.tags.key);
    });

    it('GetAtt can resolve account name of other account', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.OtherAccountName).to.eq(otherAccount.accountName);
    });

    it('GetAtt can resolve account id of other account', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.OtherAccountId).to.eq(otherAccountId);
    });

    it('GetAtt can resolve account root email of other account', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.OtherRootEmail).to.eq(otherAccount.rootEmail);
    });

    it('GetAtt can resolve account tags of other account', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.OtherTag).to.eq(otherAccount.tags.key);
    });

    it('GetAtt can resolve alias of other account', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.OtherAlias).to.eq(otherAccount.alias);
    });
});

describe('when using Sub on account', () => {
    let template: CfnTemplate;
    let templateRoot: TemplateRoot;
    let persistedState: PersistedState;
    let target: IResourceTarget;
    let templateResource: any;

    let masterAccountId;
    const otherAccountId = '22332233223322';
    let otherAccount: AccountResource;

    beforeEach(async () => {
        templateRoot = TestTemplates.createBasicTemplate();
        const masterAccountLogicalId = templateRoot.organizationSection.masterAccount.logicalId;
        masterAccountId = templateRoot.organizationSection.masterAccount.accountId;

        otherAccount = templateRoot.organizationSection.accounts[1];
        const otherAccountLogicalId = otherAccount.logicalId;

        persistedState = PersistedState.CreateEmpty(masterAccountId);
        persistedState.setBinding({ type: OrgResourceTypes.MasterAccount, logicalId: masterAccountLogicalId, physicalId: masterAccountId, lastCommittedHash: '' });
        persistedState.setBinding({ type: OrgResourceTypes.Account, logicalId: otherAccountLogicalId, physicalId: otherAccountId, lastCommittedHash: '' });

        target = {
            region: 'eu-central-1',
            accountLogicalId: templateRoot.organizationSection.accounts[0].logicalId,
            resources: [
                new CloudFormationResource(templateRoot, 'resource',
                    {
                        Type: 'AWS::Custom',
                        Properties: {
                            MasterAccountRef: { 'Fn::Sub' : '${' + masterAccountLogicalId + '}' },
                            OtherAccountRef: { 'Fn::Sub' : '${' + otherAccountLogicalId + '}' },
                            NonAccountRef: { 'Fn::Sub' : '${' + 'something' + '}' },
                            CombinedAccountRef: { 'Fn::Sub' : '${' + masterAccountLogicalId + '}-${' + otherAccountLogicalId + '}-${' + 'something' + '}' },
                            OtherAccountName: { 'Fn::Sub' : '${' + otherAccountLogicalId + '.AccountName' + '}' },
                            OtherAccountId: { 'Fn::Sub' : '${' + otherAccountLogicalId + '.AccountId' + '}' },
                            OtherRootEmail: { 'Fn::Sub' : '${' + otherAccountLogicalId + '.RootEmail' + '}' },
                            OtherRootAlias: { 'Fn::Sub' : '${' + otherAccountLogicalId + '.Alias' + '}' },
                            OtherTag: { 'Fn::Sub' : '${' + otherAccountLogicalId + '.Tags.key' + '}' },
                            TwoRootAliases: { 'Fn::Sub' : '1${' + otherAccountLogicalId + '.Alias' + '}2${' + otherAccountLogicalId + '.Alias' + '}' },
                            AccountIdTag: {'Fn::Sub' : 'arn:aws:iam::${AWS::AccountId}:root'},
                            SubWithoutExpressionTag: {'Fn::Sub' : 'something'},
                        },
                    }),
            ],
        };

        template = new CfnTemplate(target, templateRoot, persistedState);
        const templateForTarget = JSON.parse(template.createTemplateBody());
        templateResource = templateForTarget.Resources.resource;
    });

    it('Sub resolves to physical id for master account', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.MasterAccountRef).to.eq(masterAccountId);
    });

    it('Sub resolves to physical id for regular account', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.OtherAccountRef).to.eq(otherAccountId);
    });

    it('Sub does not change if logicalId is not an account', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.NonAccountRef['Fn::Sub']).to.not.be.undefined;
        expect(templateResource.Properties.NonAccountRef['Fn::Sub']).to.eq('${' + 'something' + '}');
    });

    it('Sub does replace multiple values', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.CombinedAccountRef['Fn::Sub']).to.not.be.undefined;
        expect(templateResource.Properties.CombinedAccountRef['Fn::Sub']).to.contain('${' + 'something' + '}');
        expect(templateResource.Properties.CombinedAccountRef['Fn::Sub']).to.contain(otherAccountId);
        expect(templateResource.Properties.CombinedAccountRef['Fn::Sub']).to.contain(masterAccountId);
    });

    it('Sub can resolve account name of other account', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.OtherAccountName).to.eq(otherAccount.accountName);
    });

    it('Sub can resolve account id of other account', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.OtherAccountId).to.eq(otherAccountId);
    });

    it('Sub can resolve account root email of other account', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.OtherRootEmail).to.eq(otherAccount.rootEmail);
    });

    it('Sub can resolve account tags of other account', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.OtherTag).to.eq(otherAccount.tags.key);
    });

    it('Sub wont resolve AWS expressions', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.AccountIdTag['Fn::Sub']).to.eq('arn:aws:iam::${AWS::AccountId}:root');
    });

    it('Sub wont resolve string without expression', () => {
        expect(templateResource).to.not.be.undefined;
        expect(templateResource.Properties.SubWithoutExpressionTag['Fn::Sub']).to.eq('something');
    });

    it('Sub can resolve multiple expressions', () => {
        expect(templateResource).to.not.be.undefined;
        const firstIndexOf = templateResource.Properties.TwoRootAliases.indexOf('account-2');
        const lastIndexOf = templateResource.Properties.TwoRootAliases.lastIndexOf('account-2');
        expect(firstIndexOf).to.not.eq(lastIndexOf);
    });
});
