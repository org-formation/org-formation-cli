import { IAccountProperties } from '~parser/model/account-resource';
import { IOrganizationRootProperties } from '~parser/model/organization-root-resource';
import { IOrganizationalUnitProperties } from '~parser/model/organizational-unit-resource';
import { OrgResourceTypes } from '~parser/model/resource-types';
import { IServiceControlPolicyProperties, ServiceControlPolicyResource } from '~parser/model/service-control-policy-resource';
import { ITemplate, TemplateRoot, IOrganizationBinding } from '~parser/parser';

describe('when evaluating bindings', () => {
    let template: TemplateRoot;
    const contents: ITemplate = {
        AWSTemplateFormatVersion: '2010-09-09-OC',
        Organization: {
            Root: {
                Type: OrgResourceTypes.OrganizationRoot,
                Properties: {
                    ServiceControlPolicies: { Ref: 'Policy' },
                } as IOrganizationRootProperties,
            },
            OU: {
                Type: OrgResourceTypes.OrganizationalUnit,
                Properties: {
                    OrganizationalUnitName: 'ou1',
                    ServiceControlPolicies: { Ref: 'Policy' },
                    Accounts: { Ref: 'Account' },
                    OrganizationalUnits: { Ref: 'OUChild' },
                } as IOrganizationalUnitProperties,
            },
            OUChild: {
                Type: OrgResourceTypes.OrganizationalUnit,
                Properties: {
                    OrganizationalUnitName: 'ou-child',
                    ServiceControlPolicies: [{ Ref: 'Policy' }, { Ref: 'Policy2' }],
                    Accounts: [{ Ref: 'Account2' }, { Ref: 'Account3' }],
                } as IOrganizationalUnitProperties,
            },
            MasterAccount: {
                Type: OrgResourceTypes.MasterAccount,
                Properties: {
                    AccountName: 'master',
                    RootEmail: 'emai3l@email.com',
                    AccountId: '123123123123',
                } as IAccountProperties,
            },
            Account: {
                Type: OrgResourceTypes.Account,
                Properties: {
                    AccountName: 'account1',
                    RootEmail: 'email@email.com',
                    ServiceControlPolicies: { Ref: 'Policy' },
                } as IAccountProperties,
            },
            Account2: {
                Type: OrgResourceTypes.Account,
                Properties: {
                    AccountName: 'account2',
                    RootEmail: 'email2@email.com',
                } as IAccountProperties,
            },
            Account3: {
                Type: OrgResourceTypes.Account,
                Properties: {
                    AccountName: 'account3',
                    RootEmail: 'email3@email.com',
                } as IAccountProperties,
            },
            Policy: {
                Type: OrgResourceTypes.ServiceControlPolicy,
                Properties: {
                    PolicyName: 'policy1',
                    PolicyDocument: 'policy document',
                } as IServiceControlPolicyProperties,
            },
            Policy2: {
                Type: OrgResourceTypes.ServiceControlPolicy,
                Properties: {
                    PolicyName: 'policy2',
                    PolicyDocument: 'policy document',
                } as IServiceControlPolicyProperties,
            },
        },
    };

    beforeEach(() => {
        template = new TemplateRoot(contents, './');
    });

    test('master account can be bound to by name', () => {
        const binding: IOrganizationBinding = {
            Account: { Ref: 'MasterAccount' }
        };
        const resolvedAccounts = template.resolveNormalizedLogicalAccountIds(binding);
        expect(resolvedAccounts).toBeDefined();
        expect(resolvedAccounts.length).toBe(1);
        expect(resolvedAccounts.includes('MasterAccount')).toBeTruthy();
    })


    test('binding on * will not return master account', () => {
        const binding: IOrganizationBinding = {
            Account: '*'
        };
        const resolvedAccounts = template.resolveNormalizedLogicalAccountIds(binding);
        expect(resolvedAccounts).toBeDefined();
        expect(resolvedAccounts.length).toBe(3);
        expect(resolvedAccounts.includes('Account')).toBeTruthy();
        expect(resolvedAccounts.includes('Account2')).toBeTruthy();
        expect(resolvedAccounts.includes('Account3')).toBeTruthy();
        expect(resolvedAccounts.includes('MasterAccount')).toBeFalsy();
    })

    test('ou without child will return accounts only directly within ou', () => {
        const binding: IOrganizationBinding = {
            OrganizationalUnit: { Ref: 'OUChild' }
        };
        const resolvedAccounts = template.resolveNormalizedLogicalAccountIds(binding);
        expect(resolvedAccounts).toBeDefined();
        expect(resolvedAccounts.length).toBe(2);
        expect(resolvedAccounts.includes('Account2')).toBeTruthy();
        expect(resolvedAccounts.includes('Account3')).toBeTruthy();
    })

    test('ou with child ou will return accounts from child', () => {
        const binding: IOrganizationBinding = {
            OrganizationalUnit: { Ref: 'OU' }
        };
        const resolvedAccounts = template.resolveNormalizedLogicalAccountIds(binding);
        expect(resolvedAccounts).toBeDefined();
        expect(resolvedAccounts.length).toBe(3);
        expect(resolvedAccounts.includes('Account')).toBeTruthy();
        expect(resolvedAccounts.includes('Account2')).toBeTruthy();
        expect(resolvedAccounts.includes('Account3')).toBeTruthy();
    })

    test('ou can be excluded', () => {
        const binding: IOrganizationBinding = {
            Account: "*",
            ExcludeOrganizationalUnit: { Ref: 'OUChild' }
        };
        const resolvedAccounts = template.resolveNormalizedLogicalAccountIds(binding);
        expect(resolvedAccounts).toBeDefined();
        expect(resolvedAccounts.length).toBe(1);
        expect(resolvedAccounts.includes('Account')).toBeTruthy();
    })
    test('ou will exclude child ou', () => {
        const binding: IOrganizationBinding = {
            Account: "*",
            IncludeMasterAccount: true,
            ExcludeOrganizationalUnit: { Ref: 'OU' }
        };
        const resolvedAccounts = template.resolveNormalizedLogicalAccountIds(binding);
        expect(resolvedAccounts).toBeDefined();
        expect(resolvedAccounts.length).toBe(1);
        expect(resolvedAccounts.includes('MasterAccount')).toBeTruthy();
    })
    test('all accounts can be excluded by ou', () => {
        const binding: IOrganizationBinding = {
            Account: "*",
            ExcludeOrganizationalUnit: { Ref: 'OU' }
        };
        const resolvedAccounts = template.resolveNormalizedLogicalAccountIds(binding);
        expect(resolvedAccounts).toBeDefined();
        expect(resolvedAccounts.length).toBe(0);
    })
});