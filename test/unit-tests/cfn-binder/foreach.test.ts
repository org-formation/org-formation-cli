import { expect } from 'chai';
import { CloudFormationBinder, ICfnBinding } from '../../../src/cfn-binder/cfn-binder';
import { OrgResourceTypes } from '../../../src/parser/model/resource-types';
import { TemplateRoot } from '../../../src/parser/parser';
import { PersistedState } from '../../../src/state/persisted-state';
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

    it('creates 1 binding', () => {
        expect(bindings).to.not.be.undefined;
    });

    it('creates template for master account', () => {
        expect(masterAccountCfnTemplate).to.not.be.undefined;
    });

    it('template has 4 resources (one for every account)', () => {
        const resources = Object.keys(masterAccountCfnTemplate.Resources);
        expect(resources.length).to.eq(4);
    });

    it('AccountId in ref is replaced', () => {
        for (const resourceName in masterAccountCfnTemplate.Resources) {
            const resource = masterAccountCfnTemplate.Resources[resourceName];
            expect(resource.Properties.AccountId).to.not.be.undefined;
            expect(resource.Properties.AccountId).to.not.be.undefined;
            expect(resource.Properties.AccountId).to.not.contain('CurrentAccount');
        }
    });

    it('Tag in Get Att is replaced', () => {
        for (const resourceName in masterAccountCfnTemplate.Resources) {
            const resource = masterAccountCfnTemplate.Resources[resourceName];
            expect(resource.Properties.TagInGetAtt).to.not.be.undefined;
            expect(resource.Properties.TagInGetAtt).to.not.be.undefined;
            expect(resource.Properties.TagInGetAtt).to.not.contain('CurrentAccount');
        }
    });

    it('Tag in sub is replaced', () => {
        for (const resourceName in masterAccountCfnTemplate.Resources) {
            const resource = masterAccountCfnTemplate.Resources[resourceName];
            expect(resource.Properties.TagInSub).to.not.be.undefined;
            expect(resource.Properties.TagInSub['Fn::Sub']).to.not.be.undefined;
            expect(resource.Properties.TagInSub['Fn::Sub']).to.not.contain('CurrentAccount');
        }
    });
});
