import { CloudFormationBinder, ICfnBinding } from '~cfn-binder/cfn-binder';
import { OrgResourceTypes } from '~parser/model/resource-types';
import { TemplateRoot } from '~parser/parser';
import { PersistedState } from '~state/persisted-state';
import { ICfnTemplate } from '../cfn-types';

describe('when loading default-organization-bindings template', () => {
    let template: TemplateRoot;
    let cloudformationBinder: CloudFormationBinder;
    let bindings: ICfnBinding[];
    let account1Binding: ICfnBinding;
    let account1CfnTemplate: ICfnTemplate;
    let account2Binding: ICfnBinding;
    let account2CfnTemplate: ICfnTemplate;
    let account3Binding: ICfnBinding;
    let account3CfnTemplate: ICfnTemplate;

    beforeEach(async () => {
        template = await TemplateRoot.create('./test/resources/defaults/default-organization-bindings.yml');
        const persistedState = PersistedState.CreateEmpty(template.organizationSection.masterAccount.accountId);

        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '000000000000', logicalId: 'MasterAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '111111111111', logicalId: 'Account1', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '222222222222', logicalId: 'Account2', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '333333333333', logicalId: 'Account3', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '444444444444', logicalId: 'Account4', lastCommittedHash: 'abc'});

        cloudformationBinder = new CloudFormationBinder('default-organization-bindings', template, persistedState);
        bindings = await cloudformationBinder.enumBindings();
        account1Binding = bindings.find((x) => x.accountId === '111111111111');
        account1CfnTemplate = JSON.parse(account1Binding.template.createTemplateBody()) as ICfnTemplate;
        account2Binding = bindings.find((x) => x.accountId === '222222222222');
        account2CfnTemplate = JSON.parse(account2Binding.template.createTemplateBody()) as ICfnTemplate;
        account3Binding = bindings.find((x) => x.accountId === '333333333333');
        account3CfnTemplate = JSON.parse(account3Binding.template.createTemplateBody()) as ICfnTemplate;
    });

    test('can create cfn bindings for template', () => {
        expect(bindings).toBeDefined();
    });

    test('creates 3 bindings for template', () => {
        expect(bindings.length).toBe(3);
    });

    test('only Account1 and Account2 have Topic1', () => {
        expect(account1CfnTemplate.Resources.Topic1).toBeDefined();
        expect(account2CfnTemplate.Resources.Topic1).toBeDefined();
        expect(account3CfnTemplate.Resources.Topic1).toBeUndefined();
    });

    test('only Account1 and Account2 have S3Bucket1', () => {
        expect(account1CfnTemplate.Resources.S3Bucket1).toBeDefined();
        expect(account2CfnTemplate.Resources.S3Bucket1).toBeDefined();
        expect(account3CfnTemplate.Resources.S3Bucket1).toBeUndefined();
    });

    test('only Account2 and Account3 have S3Bucket2', () => {
        expect(account1CfnTemplate.Resources.S3Bucket2).toBeUndefined();
        expect(account2CfnTemplate.Resources.S3Bucket2).toBeDefined();
        expect(account3CfnTemplate.Resources.S3Bucket2).toBeDefined();
    });

});
