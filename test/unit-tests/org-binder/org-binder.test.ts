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

    test('no accounts/policies/OU\'s are updated', () => {
        expect(templateProvider.createOrganizationalUnitUpdateTasks.callCount).toBe(0);
        expect(templateProvider.createAccountUpdateTasks.callCount).toBe(0);
        expect(templateProvider.createPolicyUpdateTasks.callCount).toBe(0);
    });

    test('creates create tasks for all accounts', () => {
        const accounts = [template.organizationSection.masterAccount, ...template.organizationSection.accounts];
        expect(templateProvider.createAccountCreateTasks.callCount).toBe(accounts.length);
        for (const account of accounts) {
            expect(templateProvider.createAccountCreateTasks.calledWith(account, account.calculateHash())).toBe(true);
        }
    });

});
