import { CloudFormationBinder, ICfnBinding } from '~cfn-binder/cfn-binder';
import { OrgResourceTypes } from '~parser/model/resource-types';
import { TemplateRoot } from '~parser/parser';
import { PersistedState } from '~state/persisted-state';

describe('when resolving organization binding through parameter', () => {
    let template: TemplateRoot;
    let cloudformationBinder: CloudFormationBinder;
    let bindings: ICfnBinding[];
    beforeEach(async () => {
        template = TemplateRoot.create('./test/resources/organization-binding/organization-binding-through-param.yml');
        const persistedState = PersistedState.CreateEmpty(template.organizationSection.masterAccount.accountId);

        persistedState.setBinding({type: OrgResourceTypes.MasterAccount, physicalId: '000000000000', logicalId: 'MasterAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '222222222222', logicalId: 'SharedUsersAccount', lastCommittedHash: 'abc'});

        cloudformationBinder = new CloudFormationBinder('organization-binding-on-account-id', template, persistedState);
        bindings = await cloudformationBinder.enumBindings();
    });

    test('can create cfn bindings for template', () => {
        expect(bindings).toBeDefined();
    });

    test('will create 2 templates', () => {
        expect(bindings.length).toBe(2);
    });

    test('will create binding for users account', () => {
        expect(bindings.find((x) => x.accountId === '222222222222')).toBeDefined();
    });

    test('will create binding for master account', () => {
        expect(bindings.find((x) => x.accountId === '000000000000')).toBeDefined();
    });
});

describe('when trying to resolve organization binding with accountId', () => {
    test('error is thrown', () => {
        try {
            TemplateRoot.create('./test/resources/organization-binding/organization-binding-account-id.yml');
            throw new Error('error expected');
        } catch (err) {
            expect(err).toBeDefined();
            expect(err.message).toEqual(expect.stringContaining('123123123123'));
            expect(err.message).toEqual(expect.stringContaining('not supported'));
            expect(err.message).toEqual(expect.stringContaining('!Ref logicalId '));
        }
    });
});
