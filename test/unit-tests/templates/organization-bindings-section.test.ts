import { expect } from 'chai';
import { CloudFormationBinder, ICfnBinding } from '../../../src/cfn-binder/cfn-binder';
import { OrgResourceTypes } from '../../../src/parser/model/resource-types';
import { TemplateRoot } from '../../../src/parser/parser';
import { PersistedState } from '../../../src/state/persisted-state';

describe('when  using organization bindings section', () => {
    let template: TemplateRoot;
    let cloudformationBinder: CloudFormationBinder;
    let bindings: ICfnBinding[];

    beforeEach(() => {
        template = TemplateRoot.create('./test/resources/organization-bindings-section/organization-bindings-section.yml');
        const persistedState = PersistedState.CreateEmpty(template.organizationSection.masterAccount.accountId);

        persistedState.setBinding({type: OrgResourceTypes.MasterAccount, physicalId: '000000000000', logicalId: 'MasterAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '111111111111', logicalId: 'Account1', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '222222222222', logicalId: 'Account2', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '333333333333', logicalId: 'Account3', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '444444444444', logicalId: 'Account4', lastCommittedHash: 'abc'});

        cloudformationBinder = new CloudFormationBinder('organization-bindings-section', template, persistedState);
        bindings = cloudformationBinder.enumBindings();
    });

    it('can create cfn bindings for template', () => {
        expect(bindings).to.not.be.undefined;
    });

    it('Resource 1 has binding to all accounts', () => {
        const resource1 = template.resourcesSection.resources.find((x) => x.logicalId === 'Resource1');
        expect(resource1.normalizedBoundAccounts).to.not.be.undefined;
        expect(resource1.normalizedBoundAccounts.length).to.eq(5);
    });

    it('Resource 2 has binding to only master', () => {
        const resource2 = template.resourcesSection.resources.find((x) => x.logicalId === 'Resource2');
        expect(resource2.normalizedBoundAccounts).to.not.be.undefined;
        expect(resource2.normalizedBoundAccounts.length).to.eq(1);
        expect(resource2.normalizedBoundAccounts[0]).to.eq('MasterAccount');
    });

    it('Resource 3 has binding to only master and foreach on all', () => {
        const resource3 = template.resourcesSection.resources.find((x) => x.logicalId === 'Resource3');
        expect(resource3.normalizedBoundAccounts).to.not.be.undefined;
        expect(resource3.normalizedBoundAccounts.length).to.eq(1);
        expect(resource3.normalizedBoundAccounts[0]).to.eq('MasterAccount');
        expect(resource3.normalizedForeachAccounts).to.not.be.undefined;
        expect(resource3.normalizedForeachAccounts.length).to.eq(5);

    });
});
