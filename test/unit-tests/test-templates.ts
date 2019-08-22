import { IAccountProperties } from '../../src/parser/model/account-resource';
import { IOrganizationRootProperties } from '../../src/parser/model/organization-root-resource';
import { IOrganizationalUnitProperties } from '../../src/parser/model/organizational-unit-resource';
import { OrgResourceTypes } from '../../src/parser/model/resource-types';
import { IServiceControlPolicyProperties } from '../../src/parser/model/service-control-policy-resource';
import { ITemplate, TemplateRoot } from '../../src/parser/parser';

export class TestTemplates {
    public static createBasicTemplate(): TemplateRoot {
        const template: ITemplate  = {
            AWSTemplateFormatVersion: '2010-09-09-OC',
            Organization: {
                MasterAccount: {
                    Type: OrgResourceTypes.MasterAccount,
                    Properties: {
                        AccountId: '1232342341234',
                        AccountName: 'My Master Account',
                        RootEmail: 'master-account@myorg.com',
                    } as IAccountProperties,
                },
                Account: {
                    Type: OrgResourceTypes.Account,
                    Properties: {
                        AccountName: 'My Account 1',
                        RootEmail: 'account-1@myorg.com',
                    } as IAccountProperties,
                },
                Account2: {
                    Type: OrgResourceTypes.Account,
                    Properties: {
                        AccountName: 'My Account 2',
                        RootEmail: 'account-2@myorg.com',
                    } as IAccountProperties,
                },
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
                        Accounts: [{ Ref: 'Account2'}],
                    } as IOrganizationalUnitProperties,
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

        return new TemplateRoot(template, './');
    }
}
