import { expect } from 'chai';
import { CloudFormationBinder, ICfnBinding } from '../../../src/cfn-binder/cfn-binder';
import { OrgResourceTypes } from '../../../src/parser/model/resource-types';
import { TemplateRoot } from '../../../src/parser/parser';
import { PersistedState } from '../../../src/state/persisted-state';

describe('when resolving organization binding through parameter', () => {
    let template: TemplateRoot;
    let cloudformationBinder: CloudFormationBinder;
    let bindings: ICfnBinding[];
    beforeEach(() => {
        template = TemplateRoot.create('./test/resources/organization-binding/organization-binding-through-param.yml');
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

describe('when trying to resolve organization binding with accountId', () => {
    it('error is thrown', () => {
        try {
            TemplateRoot.create('./test/resources/organization-binding/organization-binding-account-id.yml');
            throw new Error('error expected');
        } catch (err) {
            expect(err).to.not.be.undefined;
            expect(err.message).to.contain('123123123123');
            expect(err.message).to.contain('not supported');
            expect(err.message).to.contain('!Ref logicalId ');
        }
    });
});
