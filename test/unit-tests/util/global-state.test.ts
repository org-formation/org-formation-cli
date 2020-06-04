import { GlobalState } from "~util/global-state";
import { IState, PersistedState } from "~state/persisted-state";
import { ITemplate, TemplateRoot } from "~parser/parser";
import { OrgResourceTypes, IOrganizationRootProperties, IAccountProperties } from "~parser/model";

const state: IState = {
    previousTemplate: '',
    masterAccountId: '123123123123',
    bindings: {
        "OC::ORG::MasterAccount": {
            "MasterAccount": {
              "type": "OC::ORG::MasterAccount",
              "logicalId": "MasterAccount",
              "physicalId": "111111111111",
              "lastCommittedHash": "abcdef"
            }
          },
            "OC::ORG::Account": {
            "Account1": {
              "type": "OC::ORG::Account",
              "logicalId": "Account1",
              "physicalId": "222222222222",
              "lastCommittedHash": "abcdef"
            },
            "Account2": {
              "type": "OC::ORG::Account",
              "logicalId": "Account2",
              "physicalId": "333333333333",
              "lastCommittedHash": "abcdef"
            }
          },
    },
    stacks: {},
    values: {},
    trackedTasks: {},
}

const template : ITemplate = {
    AWSTemplateFormatVersion: '2010-09-09-OC',
    Organization: {
        Root: {
            Type: OrgResourceTypes.OrganizationRoot,
            Properties: {
                DefaultOrganizationAccessRoleName: 'Default'
            } as IOrganizationRootProperties,
        },
        Master: {
            Type: OrgResourceTypes.MasterAccount,
            Properties: {
                OrganizationAccessRoleName: 'Override',
                AccountName: 'Master',
                AccountId: '111111111111'
            } as IAccountProperties,
        },
        Account1: {
            Type: OrgResourceTypes.Account,
            Properties: {
                OrganizationAccessRoleName: 'Override',
                AccountName: 'Account1',
                RootEmail: 'email2@email.com'
            } as IAccountProperties,
        },
        Account2: {
            Type: OrgResourceTypes.Account,
            Properties: {
                RootEmail: 'email3@email.com',
                AccountName: 'Account2'
            } as IAccountProperties,
        },
        NewAccountCustomRole: {
            Type: OrgResourceTypes.Account,
            Properties: {
                RootEmail: 'email4@email.com',
                AccountName: 'Account3',
                AccountId: '444444444444',
                OrganizationAccessRoleName: 'SomethingDifferent',
            } as IAccountProperties,
        },
    }
}

describe('when determining iam cross account role name', () => {
    beforeEach(() => {
        const templateRoot = TemplateRoot.createFromContents(JSON.stringify(template))
        const persistedState = new PersistedState(state);

        GlobalState.Init(persistedState, templateRoot);
    });

    test('can resolve cross account role name from organization root', () => {
        const roleName = GlobalState.GetCrossAccountRoleName('333333333333');
        expect(roleName).toBe('Default');
    })

    test('can resolve cross account role name from value overridden by account', () => {
        const roleName = GlobalState.GetCrossAccountRoleName('222222222222');
        expect(roleName).toBe('Override');
    })

    test('can resolve cross account role role name without state', () => {
        const roleName = GlobalState.GetCrossAccountRoleName('444444444444');
        expect(roleName).toBe('SomethingDifferent');
    })

    afterEach(() => {
        GlobalState.Init(undefined, undefined);
    });
});
