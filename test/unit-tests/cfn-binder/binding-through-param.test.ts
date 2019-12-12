import { expect } from 'chai';
import { CloudFormationBinder, ICfnBinding } from '../../../src/cfn-binder/cfn-binder';
import { OrgResourceTypes } from '../../../src/parser/model/resource-types';
import { TemplateRoot } from '../../../src/parser/parser';
import { PersistedState } from '../../../src/state/persisted-state';
import { ICfnRefValue, ICfnTemplate } from '../cfn-types';

describe('when loading account with binding on account Id', () => {
    let template: TemplateRoot;
    let cloudformationBinder: CloudFormationBinder;
    let bindings: ICfnBinding[];
    beforeEach(() => {
        template = TemplateRoot.create('./test/resources/organization-binding-through-param/organization-binding-through-param.yml');
        const persistedState = PersistedState.CreateEmpty(template.organizationSection.masterAccount.accountId);

        persistedState.setBinding({type: OrgResourceTypes.MasterAccount, physicalId: '000000000000', logicalId: 'MasterAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '222222222222', logicalId: 'SharedUsersAccount', lastCommittedHash: 'abc'});

        cloudformationBinder = new CloudFormationBinder('organization-binding-on-account-id', template, persistedState);
        bindings = cloudformationBinder.enumBindings();
    });

    it('can create cfn bindings for template', () => {
        expect(bindings).to.not.be.undefined;
    });

    it('will create 2 templates', () => {
        expect(bindings.length).to.eq(2);
    });

    it('will create binding for users account', () => {
        expect(bindings.find((x) => x.accountId === '222222222222')).to.not.be.undefined;
    });

    it('will create binding for master account', () => {
        expect(bindings.find((x) => x.accountId === '000000000000')).to.not.be.undefined;
    });
});
