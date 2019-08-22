import { expect } from 'chai';
import * as chai from 'chai';
import { IAccountProperties } from '../../../src/parser/model/account-resource';
import { IMasterAccountProperties } from '../../../src/parser/model/master-account-resource';
import { IOrganizationRootProperties } from '../../../src/parser/model/organization-root-resource';
import { IOrganizationalUnitProperties } from '../../../src/parser/model/organizational-unit-resource';
import { OrgResourceTypes } from '../../../src/parser/model/resource-types';
import { IServiceControlPolicyProperties } from '../../../src/parser/model/service-control-policy-resource';
import { ITemplate, TemplateRoot } from '../../../src/parser/parser';

chai.use(require('chai-as-promised'));

describe('when validating organization section', () => {
    let contents: ITemplate;

    beforeEach( () => {
        contents = {
            AWSTemplateFormatVersion: '2010-09-09-OC',
            Organization: {
                Root: {
                    Type: OrgResourceTypes.OrganizationRoot,
                    Properties: {
                        ServiceControlPolicies: { Ref: 'Policy'},
                    } as IOrganizationRootProperties,
                },
                OU: {
                    Type: OrgResourceTypes.OrganizationalUnit,
                    Properties: {
                        OrganizationalUnitName: 'ou1',
                        ServiceControlPolicies: { Ref: 'Policy'},
                        Accounts: { Ref: 'Account'},
                    } as IOrganizationalUnitProperties,
                },
                OU2: {
                    Type: OrgResourceTypes.OrganizationalUnit,
                    Properties: {
                        OrganizationalUnitName: 'ou2',
                        ServiceControlPolicies: [{ Ref: 'Policy'}, { Ref: 'Policy2'}],
                        Accounts: [{ Ref: 'Account2'}, { Ref: 'Account3'}],
                    } as IOrganizationalUnitProperties,
                },
                Account: {
                    Type: OrgResourceTypes.Account,
                    Properties: {
                        AccountName: 'account1',
                        AccountId: '123123123123',
                        ServiceControlPolicies: { Ref: 'Policy'},
                    } as IAccountProperties,
                },
                Account2: {
                    Type: OrgResourceTypes.Account,
                    Properties: {
                        AccountId: '123123123124',
                        RootEmail: 'email@email.com',
                        AccountName: 'account2',
                    } as IAccountProperties,
                },
                Account3: {
                    Type: OrgResourceTypes.Account,
                    Properties: {
                        AccountId: '123123123125',
                        AccountName: 'account3',
                    } as IAccountProperties,
                },
                Policy: {
                    Type : OrgResourceTypes.ServiceControlPolicy,
                    Properties: {
                        PolicyName: 'policy1',
                        PolicyDocument: 'policy document',
                    } as IServiceControlPolicyProperties,
                },
                Policy2: {
                    Type : OrgResourceTypes.ServiceControlPolicy,
                    Properties: {
                        PolicyName: 'policy2',
                        PolicyDocument: 'policy document',
                    } as IServiceControlPolicyProperties,
                },
            },
        };
    });

    it('error is thrown for unknown organization resource type', () => {
        contents.Organization.Resource = {
            Type: OrgResourceTypes.Account,
            Properties: {},
        };
        (contents.Organization.Resource as any).Type = 'Something-Different';
        expect(() => { new TemplateRoot(contents, './'); }).to.throw(/Something-Different/);
    });

    it('error is thrown for multiple organization roots', () => {
        contents.Organization.Root2 = {
            Type: OrgResourceTypes.OrganizationRoot,
            Properties: {
                ServiceControlPolicies: { Ref: 'Policy'},
            } as IOrganizationRootProperties,
        };
        expect(() => { new TemplateRoot(contents, './'); }).to.throw(/organization root/);
    });

    it('error is thrown for multiple master accounts', () => {
        contents.Organization.Master1 = {
            Type: OrgResourceTypes.MasterAccount,
            Properties: {
                AccountName: 'Master 1',
                RootEmail: 'my@email.com',
            } as IMasterAccountProperties,
        };
        contents.Organization.Master2 = {
            Type: OrgResourceTypes.MasterAccount,
            Properties: {
                AccountName: 'Master 2',
                RootEmail: 'my2@email.com',
            } as IMasterAccountProperties,
        };
        expect(() => { new TemplateRoot(contents, './'); }).to.throw(/master account/);
    });

    it('error is thrown for account that is part of multiple organizational units', () => {
        contents.Organization.OU2.Properties.Accounts.push({Ref: 'Account'});
        expect(() => { new TemplateRoot(contents, './'); }).to.throw(/Account/);
        expect(() => { new TemplateRoot(contents, './'); }).to.throw(/organizational unit/);
    });

    it('error is thrown for account that is part of multiple organizational units (referencing *)', () => {
        contents.Organization.OU2.Properties.Accounts = '*';
        expect(() => { new TemplateRoot(contents, './'); }).to.throw(/Account/);
        expect(() => { new TemplateRoot(contents, './'); }).to.throw(/organizational unit/);
    });

    it('error is thrown for unknown attribute in properties of organization root', () => {
        contents.Organization.Root.Properties.additional = 'whatever';
        expect(() => { new TemplateRoot(contents, './'); }).to.throw(/Root/);
        expect(() => { new TemplateRoot(contents, './'); }).to.throw(/additional/);
    });

    it('error is thrown for unknown attribute in organization root', () => {
        (contents.Organization.Root as any).additional = 'whatever';
        expect(() => { new TemplateRoot(contents, './'); }).to.throw(/Root/);
        expect(() => { new TemplateRoot(contents, './'); }).to.throw(/additional/);
    });

    it('error is thrown for unknown attribute in organization section', () => {
        (contents.Organization as any).additional = 'whatever';
        expect(() => { new TemplateRoot(contents, './'); }).to.throw(/Organization/);
        expect(() => { new TemplateRoot(contents, './'); }).to.throw(/additional/);
    });

    it('error is thrown for unknown attribute', () => {
        (contents as any).additional = 'whatever';
        expect(() => { new TemplateRoot(contents, './'); }).to.throw(/additional/);
    });

    it('error is thrown for duplicate account name', () => {
        contents.Organization.Account.Properties.AccountName = contents.Organization.Account2.Properties.AccountName;
        expect(() => { new TemplateRoot(contents, './'); }).to.throw(/account2/);
    });

    it('error is thrown for duplicate account root email', () => {
        contents.Organization.Account.Properties.RootEmail = contents.Organization.Account2.Properties.RootEmail;
        expect(() => { new TemplateRoot(contents, './'); }).to.throw(/email@email.com/);
    });

    it('error is thrown for duplicate account id', () => {
        contents.Organization.Account.Properties.AccountId = contents.Organization.Account2.Properties.AccountId;
        expect(() => { new TemplateRoot(contents, './'); }).to.throw(/123123123124/);
    });

    it('error is thrown for duplicate account name (master)', () => {
        contents.Organization.Account.Properties.AccountName = contents.Organization.Account2.Properties.AccountName;
        contents.Organization.Account.Type = OrgResourceTypes.MasterAccount;
        delete contents.Organization.OU.Properties.Accounts;

        expect(() => { new TemplateRoot(contents, './'); }).to.throw(/account2/);
    });

    it('error is thrown for duplicate account root email (master)', () => {
        contents.Organization.Account.Properties.RootEmail = contents.Organization.Account2.Properties.RootEmail;
        contents.Organization.Account.Type = OrgResourceTypes.MasterAccount;
        delete contents.Organization.OU.Properties.Accounts;

        expect(() => { new TemplateRoot(contents, './'); }).to.throw(/email@email.com/);
    });

    it('error is thrown for duplicate account id (master)', () => {
        contents.Organization.Account.Properties.AccountId = contents.Organization.Account2.Properties.AccountId;
        contents.Organization.Account.Type = OrgResourceTypes.MasterAccount;
        delete contents.Organization.OU.Properties.Accounts;

        expect(() => { new TemplateRoot(contents, './'); }).to.throw(/123123123124/);
    });

    it('error is thrown for duplicate organizational unit name', () => {
        contents.Organization.OU2.Properties.OrganizationalUnitName = contents.Organization.OU.Properties.OrganizationalUnitName;
        expect(() => { new TemplateRoot(contents, './'); }).to.throw(/ou1/);
    });

    it('error is thrown for duplicate service control policy name', () => {
        contents.Organization.Policy2.Properties.PolicyName = contents.Organization.Policy.Properties.PolicyName;
        expect(() => { new TemplateRoot(contents, './'); }).to.throw(/policy1/);
    });
});
