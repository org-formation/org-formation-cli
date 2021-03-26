import { CloudFormationBinder, ICfnBinding } from '~cfn-binder/cfn-binder';
import { OrgResourceTypes } from '~parser/model/resource-types';
import { ITemplate, TemplateRoot } from '~parser/parser';
import { PersistedState } from '~state/persisted-state';

describe('when  using organization bindings section', () => {
    let template: TemplateRoot;
    let cloudformationBinder: CloudFormationBinder;
    let bindings: ICfnBinding[];

    beforeEach(async () => {
        template = await TemplateRoot.create('./test/resources/organization-bindings-section/organization-bindings-section.yml');
        const persistedState = PersistedState.CreateEmpty(template.organizationSection.masterAccount.accountId);

        persistedState.setBinding({ type: OrgResourceTypes.MasterAccount, physicalId: '000000000000', logicalId: 'MasterAccount', lastCommittedHash: 'abc' });
        persistedState.setBinding({ type: OrgResourceTypes.Account, physicalId: '111111111111', logicalId: 'Account1', lastCommittedHash: 'abc' });
        persistedState.setBinding({ type: OrgResourceTypes.Account, physicalId: '222222222222', logicalId: 'Account2', lastCommittedHash: 'abc' });
        persistedState.setBinding({ type: OrgResourceTypes.Account, physicalId: '333333333333', logicalId: 'Account3', lastCommittedHash: 'abc' });
        persistedState.setBinding({ type: OrgResourceTypes.Account, physicalId: '444444444444', logicalId: 'Account4', lastCommittedHash: 'abc' });

        cloudformationBinder = new CloudFormationBinder('organization-bindings-section', template, persistedState);
        bindings = await cloudformationBinder.enumBindings();
    });

    test('can create cfn bindings for template', () => {
        expect(bindings).toBeDefined();
    });

    test('Resource 1 AllCount attribute resolves to 5', () => {
        const resource1 = template.resourcesSection.resources.find((x) => x.logicalId === 'Resource1');
        expect(resource1.normalizedBoundAccounts).toBeDefined();
        expect(resource1.normalizedBoundAccounts.length).toBe(5);
    });

    test('Fn::TargetCount MasterBinding resolves to 1', () => {
        const masterTemplate = JSON.parse(bindings.find((x) => x.accountId === '000000000000').template.createTemplateBody());
        const resource1 = masterTemplate.Resources.Resource1;
        expect(resource1.Properties.MasterCount).toBe(1);
    });

    test('Fn::TargetCount AllAccountsBinding resolves to 5', () => {
        const masterTemplate = JSON.parse(bindings.find((x) => x.accountId === '000000000000').template.createTemplateBody());
        const resource1 = masterTemplate.Resources.Resource1;
        expect(resource1.Properties.AllCount).toBe(5);
    });

    test('Fn::TargetCount EmptyBinding resolves to 0', () => {
        const masterTemplate = JSON.parse(bindings.find((x) => x.accountId === '000000000000').template.createTemplateBody());
        const resource1 = masterTemplate.Resources.Resource1;
        expect(resource1.Properties.EmptyCount).toBe(0);
    });

    test('Resource 2 has binding to only master', () => {
        const resource2 = template.resourcesSection.resources.find((x) => x.logicalId === 'Resource2');
        expect(resource2.normalizedBoundAccounts).toBeDefined();
        expect(resource2.normalizedBoundAccounts.length).toBe(1);
        expect(resource2.normalizedBoundAccounts[0]).toBe('MasterAccount');
    });

    test('Resource 3 has binding to only master and foreach on all', () => {
        const resource3 = template.resourcesSection.resources.find((x) => x.logicalId === 'Resource3');
        expect(resource3.normalizedBoundAccounts).toBeDefined();
        expect(resource3.normalizedBoundAccounts.length).toBe(1);
        expect(resource3.normalizedBoundAccounts[0]).toBe('MasterAccount');
        expect(resource3.normalizedForeachAccounts).toBeDefined();
        expect(resource3.normalizedForeachAccounts.length).toBe(5);

    });

    test('Resource 4 has binding to only master and foreach on 0', () => {
        const resource4 = template.resourcesSection.resources.find((x) => x.logicalId === 'Resource4');
        expect(resource4.normalizedBoundAccounts).toBeDefined();
        expect(resource4.normalizedBoundAccounts.length).toBe(1);
        expect(resource4.normalizedBoundAccounts[0]).toBe('MasterAccount');
        expect(resource4.normalizedForeachAccounts).toBeDefined();
        expect(resource4.normalizedForeachAccounts.length).toBe(0);

    });

    test('no resource 4 in processed template', () => {
        const masterBinding = bindings.find(x => x.accountLogicalId === 'MasterAccount');
        const template = masterBinding.template.createTemplateBody();
        const parsedTemplate = JSON.parse(template) as ITemplate;
        const keys = Object.keys(parsedTemplate.Resources);
        const resource4 = keys.find(x => x.startsWith('Resource4'));
        expect(resource4).toBeUndefined();
    });

    test('Resource 5 has binding to only master and foreach on 0', () => {
        const resource5 = template.resourcesSection.resources.find((x) => x.logicalId === 'Resource5');
        expect(resource5.normalizedBoundAccounts).toBeDefined();
        expect(resource5.normalizedBoundAccounts.length).toBe(1);
        expect(resource5.normalizedBoundAccounts[0]).toBe('MasterAccount');
        expect(resource5.normalizedForeachAccounts).toBeDefined();
        expect(resource5.normalizedForeachAccounts.length).toBe(0);

    });
    test('no resource 5 in processed template', () => {
        const masterBinding = bindings.find(x => x.accountLogicalId === 'MasterAccount');
        const template = masterBinding.template.createTemplateBody();
        const parsedTemplate = JSON.parse(template) as ITemplate;
        const keys = Object.keys(parsedTemplate.Resources);
        const resource5 = keys.find(x => x.startsWith('Resource5'));
        expect(resource5).toBeUndefined();
    });
});
