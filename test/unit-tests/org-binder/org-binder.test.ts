import { expect } from 'chai';
import * as Sinon from 'sinon';
import { OrganizationBinder } from '../../../src/org-binder/org-binder';
import { IBuildTask, TaskProvider } from '../../../src/org-binder/org-tasks-provider';
import { PersistedState } from '../../../src/state/persisted-state';
import { TestTemplates } from '../test-templates';

describe('when enumerating bindings for empty state', () => {
    const template = TestTemplates.createBasicTemplate();
    const state = PersistedState.CreateEmpty(template.organizationSection.masterAccount.accountId);
    let templateProvider: Sinon.SinonStubbedInstance<TaskProvider>;

    let sut: OrganizationBinder;

    beforeEach(() => {
        templateProvider = Sinon.createStubInstance<TaskProvider>(TaskProvider);
        templateProvider.createAccountCreateTasks.returns([]);
        templateProvider.createOrganizationalUnitCreateTasks.returns([]);
        templateProvider.createPolicyCreateTasks.returns([]);
        templateProvider.createRootCreateTasks.returns([]);

        sut = new OrganizationBinder(template, state, templateProvider as any);
        sut.enumBuildTasks();
    });

    it('no accounts/policies/OU\'s are updated', () => {
        expect(templateProvider.createOrganizationalUnitUpdateTasks.callCount).to.eq(0);
        expect(templateProvider.createAccountUpdateTasks.callCount).to.eq(0);
        expect(templateProvider.createPolicyUpdateTasks.callCount).to.eq(0);
    });

    it('creates create tasks for all accounts', () => {
        const accounts = [template.organizationSection.masterAccount, ...template.organizationSection.accounts];
        expect(templateProvider.createAccountCreateTasks.callCount).to.eq(accounts.length);
        for (const account of accounts) {
            expect(templateProvider.createAccountCreateTasks.calledWith(account, account.calculateHash())).to.be.true;
        }
    });

});
