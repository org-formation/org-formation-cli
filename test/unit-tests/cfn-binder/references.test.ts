import { expect } from 'chai';
import { CloudFormationBinder } from '../../../src/cfn-binder/cfn-binder';
import { OrgResourceTypes } from '../../../src/parser/model/resource-types';
import { TemplateRoot } from '../../../src/parser/parser';
import { PersistedState } from '../../../src/state/persisted-state';

describe('when loading reference to multiple', () => {
    it ('fails with exception', () => {
        const template = TemplateRoot.create('./test/resources/references/reference-to-multiple.yml');
        const persistedState = PersistedState.CreateEmpty(template.organizationSection.masterAccount.accountId);

        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '000000000000', logicalId: 'MasterAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '111111111111', logicalId: 'Account1', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '222222222222', logicalId: 'Account2', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '333333333333', logicalId: 'Account3', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '10000000004', logicalId: 'Account4', lastCommittedHash: 'abc'});

        const cloudformationBinder = new CloudFormationBinder('foreach', template, persistedState);
        expect(() =>  cloudformationBinder.enumBindings()).to.throw(/Topic.TopicName/);
        expect(() =>  cloudformationBinder.enumBindings()).to.throw(/multiple accounts/);

    });
});
