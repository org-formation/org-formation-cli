import { expect } from 'chai';
import { CloudFormationBinder } from '../../../src/cfn-binder/cfn-binder';
import { OrgResourceTypes } from '../../../src/parser/model/resource-types';
import { TemplateRoot } from '../../../src/parser/parser';
import { PersistedState } from '../../../src/state/persisted-state';

describe('when loading reference to multiple', () => {
    it ('fails with exception', () => {
        const template = TemplateRoot.create('./test/resources/references/reference-to-multiple.yml');
        const persistedState = PersistedState.CreateEmpty(template.organizationSection.masterAccount.accountId);

        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '0', logicalId: 'MasterAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '1', logicalId: 'Account1', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '2', logicalId: 'Account2', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '3', logicalId: 'Account3', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '4', logicalId: 'Account4', lastCommittedHash: 'abc'});

        const cloudformationBinder = new CloudFormationBinder('foreach', template, persistedState);
        expect(() =>  cloudformationBinder.enumBindings()).to.throw(/Topic.TopicName/);
        expect(() =>  cloudformationBinder.enumBindings()).to.throw(/multiple accounts/);

    });
});
