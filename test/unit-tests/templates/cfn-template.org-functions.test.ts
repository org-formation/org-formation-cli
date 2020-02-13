import { CfnTemplate } from '../../../src/cfn-binder/cfn-template';
import { AccountResource } from '../../../src/parser/model/account-resource';
import { CloudFormationResource } from '../../../src/parser/model/cloudformation-resource';
import { OrgResourceTypes } from '../../../src/parser/model/resource-types';
import { IResourceTarget } from '../../../src/parser/model/resources-section';
import { TemplateRoot } from '../../../src/parser/parser';
import { PersistedState } from '../../../src/state/persisted-state';
import { TestTemplates } from '../test-templates';


describe('when using Ref on account', () => {
    let template: CfnTemplate;
    let templateRoot: TemplateRoot;
    let persistedState: PersistedState;
    let target: IResourceTarget;
    let templateResource: any;

    let masterAccountId: string;
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

    test('Ref resolves to physical id for master account', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.MasterAccountRef).toBe(masterAccountId);
    });

    test('Ref resolves to physical id for regular account', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.OtherAccountRef).toBe(otherAccountId);
    });

    test('Ref does not change if logicalId is not an account', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.NonAccountRef.Ref).toBeDefined();
        expect(templateResource.Properties.NonAccountRef.Ref).toBe('something');
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
    let masterAccountId: string;

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
                        OrganizationBinding: { Account: '*', Region: 'eu-central-1'},
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

    test('GetAtt can resolve account name of current account', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.CurrentAccountName).toBe(targetAccount.accountName);
    });

    test('GetAtt can resolve account id of current account', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.CurrentAccountId).toBe(targetAccountId);
    });

    test('GetAtt can resolve account root email of current account', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.CurrentRootEmail).toBe(targetAccount.rootEmail);
    });

    test('GetAtt can resolve account tags of current account', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.CurrentTag).toBe(targetAccount.tags.key);
    });

    test('GetAtt can resolve account name of master account', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.MasterAccountName).toBe(masterAccount.accountName);
    });

    test('GetAtt can resolve account id of master account', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.MasterAccountId).toBe(masterAccountId);
    });

    test('GetAtt can resolve account root email of master account', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.MasterRootEmail).toBe(masterAccount.rootEmail);
    });

    test('GetAtt can resolve account tags of master account', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.MasterTag).toBe(masterAccount.tags.key);
    });

    test('GetAtt can resolve account name of other account', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.OtherAccountName).toBe(otherAccount.accountName);
    });

    test('GetAtt can resolve account id of other account', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.OtherAccountId).toBe(otherAccountId);
    });

    test('GetAtt can resolve account root email of other account', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.OtherRootEmail).toBe(otherAccount.rootEmail);
    });

    test('GetAtt can resolve account tags of other account', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.OtherTag).toBe(otherAccount.tags.key);
    });

    test('GetAtt can resolve alias of other account', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.OtherAlias).toBe(otherAccount.alias);
    });
});

describe('when using Sub on account', () => {
    let template: CfnTemplate;
    let templateRoot: TemplateRoot;
    let persistedState: PersistedState;
    let target: IResourceTarget;
    let templateResource: any;

    let masterAccountId: string;
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
                        OrganizationBinding: { Account: '*'},
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
                            SubWith2Expressions: {'Fn::Sub' : '${parameter}-abc${' + otherAccountLogicalId + '.Alias' + '}'},
                            MissingAlias: {'Fn::Sub' : 'abc-${AWSAccount.Alias}'},
                        },
                    }),
            ],
        };

        template = new CfnTemplate(target, templateRoot, persistedState);
        const templateForTarget = JSON.parse(template.createTemplateBody());
        templateResource = templateForTarget.Resources.resource;
    });

    test('Sub resolves to physical id for master account', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.MasterAccountRef).toBe(masterAccountId);
    });

    test('Sub resolves to physical id for regular account', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.OtherAccountRef).toBe(otherAccountId);
    });

    test('Sub does not change if logicalId is not an account', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.NonAccountRef['Fn::Sub']).toBeDefined();
        expect(templateResource.Properties.NonAccountRef['Fn::Sub']).toBe('${' + 'something' + '}');
    });

    test('Sub does replace multiple values', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.CombinedAccountRef['Fn::Sub']).toBeDefined();
        expect(templateResource.Properties.CombinedAccountRef['Fn::Sub']).toEqual(expect.stringContaining('${' + 'something' + '}'));
        expect(templateResource.Properties.CombinedAccountRef['Fn::Sub']).toEqual(expect.stringContaining(otherAccountId));
        expect(templateResource.Properties.CombinedAccountRef['Fn::Sub']).toEqual(expect.stringContaining(masterAccountId));
    });

    test('Sub can resolve account name of other account', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.OtherAccountName).toBe(otherAccount.accountName);
    });

    test('Sub can resolve account id of other account', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.OtherAccountId).toBe(otherAccountId);
    });

    test('Sub can resolve account root email of other account', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.OtherRootEmail).toBe(otherAccount.rootEmail);
    });

    test('Sub can resolve account tags of other account', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.OtherTag).toBe(otherAccount.tags.key);
    });

    test('Sub wont resolve AWS expressions', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.AccountIdTag['Fn::Sub']).toBe('arn:aws:iam::${AWS::AccountId}:root');
    });

    test('Sub wont resolve string without expression', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.SubWithoutExpressionTag['Fn::Sub']).toBe('something');
    });

    test('Sub can resolve multiple expressions', () => {
        expect(templateResource).toBeDefined();
        const firstIndexOf = templateResource.Properties.TwoRootAliases.indexOf('account-2');
        const lastIndexOf = templateResource.Properties.TwoRootAliases.lastIndexOf('account-2');
        expect(firstIndexOf).not.toBe(lastIndexOf);
    });

    test('Sub can replace only second expression', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.SubWith2Expressions['Fn::Sub']).toEqual(expect.stringContaining('account-2'));
        expect(templateResource.Properties.SubWith2Expressions['Fn::Sub'].startsWith('${parameter}-abc'));
    });

    test('Sub replaces missing alias with empty string', () => {
        expect(templateResource).toBeDefined();
        expect(templateResource.Properties.MissingAlias).toBe('abc-');
    });
});
