import { CloudFormationBinder, ICfnBinding } from '../../../src/cfn-binder/cfn-binder';
import { OrgResourceTypes } from '../../../src/parser/model/resource-types';
import { TemplateRoot } from '../../../src/parser/parser';
import { PersistedState } from '../../../src/state/persisted-state';

describe('when loading template with resources that depend on account or region', () => {
    let template: TemplateRoot;
    let bindings: ICfnBinding[];
    let account1Binding: ICfnBinding;

    beforeEach(() => {
        template = TemplateRoot.create('./test/resources/depends-on-account/depends-on-account.yml');
        const persistedState = PersistedState.CreateEmpty(template.organizationSection.masterAccount.accountId);

        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '000000000000', logicalId: 'MasterAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '111111111111', logicalId: 'Account1', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '222222222222', logicalId: 'Account2', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '333333333333', logicalId: 'Account3', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '444444444444', logicalId: 'Account4', lastCommittedHash: 'abc'});

        const cloudformationBinder = new CloudFormationBinder('depends-on-account', template, persistedState);
        bindings = cloudformationBinder.enumBindings();
        account1Binding = bindings.find((x) => x.accountId === '111111111111');
    });

    test('can create cfn bindings for template', () => {
        expect(bindings).toBeDefined();
    });

    test('binding for account 1 has account dependency on 2 ', () => {
        expect(account1Binding.accountDependencies.length).toBe(1);
        expect(account1Binding.accountDependencies[0]).toBe('222222222222');
    });

    test('binding for account 1 has region dependency on us-east-1', () => {
        expect(account1Binding.regionDependencies.length).toBe(1);
        expect(account1Binding.regionDependencies[0]).toBe('us-east-1');
    });
});

describe('when loading template with resources that depend on account or region', () => {
    let template: TemplateRoot;
    let bindings: ICfnBinding[];
    let account1Binding: ICfnBinding;

    beforeEach(() => {
        template = TemplateRoot.create('./test/resources/depends-on-account/depends-on-account-multiple.yml');
        const persistedState = PersistedState.CreateEmpty(template.organizationSection.masterAccount.accountId);

        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '000000000000', logicalId: 'MasterAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '111111111111', logicalId: 'Account1', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '222222222222', logicalId: 'Account2', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '333333333333', logicalId: 'Account3', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '444444444444', logicalId: 'Account4', lastCommittedHash: 'abc'});

        const cloudformationBinder = new CloudFormationBinder('depends-on-account-multiple', template, persistedState);
        bindings = cloudformationBinder.enumBindings();
        account1Binding = bindings.find((x) => x.accountId === '111111111111');
    });

    test('can create cfn bindings for template', () => {
        expect(bindings).toBeDefined();
    });

    test('binding for account 1 has account dependency on 2 ', () => {
        expect(account1Binding.accountDependencies.length).toBe(1);
        expect(account1Binding.accountDependencies[0]).toBe('222222222222');
    });

    test('binding for account 1 has region dependency on us-east-1', () => {
        expect(account1Binding.regionDependencies.length).toBe(1);
        expect(account1Binding.regionDependencies[0]).toBe('us-east-1');
    });
});

describe('when loading template with resource that depends on master account', () => {
    let template: TemplateRoot;
    let bindings: ICfnBinding[];
    let account1Binding: ICfnBinding;

    beforeEach(() => {
        template = TemplateRoot.create('./test/resources/depends-on-account/depends-on-master-account.yml');
        const persistedState = PersistedState.CreateEmpty(template.organizationSection.masterAccount.accountId);

        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '000000000000', logicalId: 'MasterAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '111111111111', logicalId: 'Account1', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '222222222222', logicalId: 'Account2', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '333333333333', logicalId: 'Account3', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '444444444444', logicalId: 'Account4', lastCommittedHash: 'abc'});

        const cloudformationBinder = new CloudFormationBinder('depends-on-account', template, persistedState);
        bindings = cloudformationBinder.enumBindings();
        account1Binding = bindings.find((x) => x.accountId === '111111111111');
    });

    test('can create cfn bindings for template', () => {
        expect(bindings).toBeDefined();
    });

    test('binding for account 1 has account dependency on master ', () => {
        expect(account1Binding.accountDependencies.length).toBe(1);
        expect(account1Binding.accountDependencies[0]).toBe('000000000000');
    });
});

describe('when loading template with resources that depend on account that cannot be found', () => {

    test('creating template throws an exception', () => {
        try {
            TemplateRoot.create('./test/resources/depends-on-account/depends-on-unknown-account.yml');
            throw new Error('expected exception');
        } catch (err) {
            expect(err.message).toEqual(expect.stringContaining('AccountUnknown'));
        }
    });
});
