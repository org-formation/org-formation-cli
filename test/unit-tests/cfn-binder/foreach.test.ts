import { CloudFormationBinder, ICfnBinding } from '~cfn-binder/cfn-binder';
import { OrgResourceTypes } from '~parser/model/resource-types';
import { TemplateRoot } from '~parser/parser';
import { PersistedState } from '~state/persisted-state';
import { ICfnTemplate } from '../cfn-types';

describe('when loading template with resource that does Foreach', () => {
    let template: TemplateRoot;
    let bindings: ICfnBinding[];
    let masterAccountCfnTemplate: ICfnTemplate;

    beforeEach(() => {
        template = TemplateRoot.create('./test/resources/foreach/foreach.yml');
        const persistedState = PersistedState.CreateEmpty(template.organizationSection.masterAccount.accountId);

        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '000000000000', logicalId: 'MasterAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '111111111111', logicalId: 'Account1', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '222222222222', logicalId: 'Account2', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '333333333333', logicalId: 'Account3', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '444444444444', logicalId: 'Account4', lastCommittedHash: 'abc'});

        const cloudformationBinder = new CloudFormationBinder('foreach', template, persistedState);
        bindings = cloudformationBinder.enumBindings();
        masterAccountCfnTemplate = JSON.parse(bindings.find((x) => x.accountId === '000000000000').template.createTemplateBody()) as ICfnTemplate;
    });

    test('creates 1 binding', () => {
        expect(bindings).toBeDefined();
    });

    test('creates template for master account', () => {
        expect(masterAccountCfnTemplate).toBeDefined();
    });

    test('template has 4 resources (one for every account)', () => {
        const resources = Object.keys(masterAccountCfnTemplate.Resources);
        expect(resources.length).toBe(4);
    });

    test('AccountId in ref is replaced', () => {
        for (const resourceName in masterAccountCfnTemplate.Resources) {
            const resource = masterAccountCfnTemplate.Resources[resourceName];
            expect(resource.Properties.AccountId).toBeDefined();
            expect(resource.Properties.AccountId).toBeDefined();
            expect(resource.Properties.AccountId).toEqual(expect.not.stringContaining('CurrentAccount'));
        }
    });

    test('Tag in Get Att is replaced', () => {
        for (const resourceName in masterAccountCfnTemplate.Resources) {
            const resource = masterAccountCfnTemplate.Resources[resourceName];
            expect(resource.Properties.TagInGetAtt).toBeDefined();
            expect(resource.Properties.TagInGetAtt).toBeDefined();
            expect(resource.Properties.TagInGetAtt).toEqual(expect.not.stringContaining('CurrentAccount'));
            expect(resource.Properties.TagInSub['Fn::Sub']).toEqual(expect.not.stringContaining('Tags'));
        }
    });

    test('Tag in sub is replaced', () => {
        for (const resourceName in masterAccountCfnTemplate.Resources) {
            const resource = masterAccountCfnTemplate.Resources[resourceName];
            expect(resource.Properties.TagInSub).toBeDefined();
            expect(resource.Properties.TagInSub['Fn::Sub']).toBeDefined();
            expect(resource.Properties.TagInSub['Fn::Sub']).toEqual(expect.not.stringContaining('CurrentAccount'));
            expect(resource.Properties.TagInSub['Fn::Sub']).toEqual(expect.not.stringContaining('Tags'));
        }
    });

    test('GetAtt of resource is replaced', () => {
        for (const resourceName in masterAccountCfnTemplate.Resources) {
            const resource = masterAccountCfnTemplate.Resources[resourceName];
            expect(resource.Properties.GetAttOfResouce.Ref).toBeDefined();
        }
    });
});
