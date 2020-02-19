import { IAccountProperties } from '../../../src/parser/model/account-resource';
import { IOrganizationRootProperties } from '../../../src/parser/model/organization-root-resource';
import { IOrganizationalUnitProperties } from '../../../src/parser/model/organizational-unit-resource';
import { OrgResourceTypes } from '../../../src/parser/model/resource-types';
import { IServiceControlPolicyProperties, ServiceControlPolicyResource } from '../../../src/parser/model/service-control-policy-resource';
import { ITemplate, TemplateRoot } from '../../../src/parser/parser';

describe('when parsing organization section with references using Ref', () => {
    let template: TemplateRoot;
    const contents: ITemplate  = {
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
                    RootEmail: 'email@email.com',
                    ServiceControlPolicies: { Ref: 'Policy'},
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

    beforeEach(() => {
        template = new TemplateRoot(contents, './');
    });

    test('service control policy can be referenced using !Ref by Organizational Unit',
        () => {
            const organizationalUnit = template.organizationSection.organizationalUnits[0];
            expect(organizationalUnit.serviceControlPolicies.length).toBe(1);
            const resource = organizationalUnit.serviceControlPolicies[0].TemplateResource;
            expect(resource).toBeDefined();

            const serviceControlPolicy = template.organizationSection.serviceControlPolicies[0];
            expect(resource).toBe(serviceControlPolicy);
        }
    );

    test('service control policy can be referenced using !Ref by Organizational Root',
        () => {
            const organizationalRoot = template.organizationSection.organizationRoot;
            expect(organizationalRoot.serviceControlPolicies.length).toBe(1);
            const resource = organizationalRoot.serviceControlPolicies[0].TemplateResource;
            expect(resource).toBeDefined();

            const serviceControlPolicy = template.organizationSection.serviceControlPolicies[0];
            expect(resource).toBe(serviceControlPolicy);
        }
    );
    test('service control policy can be referenced using !Ref by Account', () => {
        const account = template.organizationSection.accounts[0];
        expect(account.serviceControlPolicies.length).toBe(1);
        const resource = account.serviceControlPolicies[0].TemplateResource;
        expect(resource).toBeDefined();

        const serviceControlPolicy = template.organizationSection.serviceControlPolicies[0];
        expect(resource).toBe(serviceControlPolicy);
    });

    test('Account can be referenced using !Ref by Organizational Unit', () => {
        const organizationalUnit = template.organizationSection.organizationalUnits[0];
        expect(organizationalUnit.accounts.length).toBe(1);
        const resource = organizationalUnit.accounts[0].TemplateResource;
        expect(resource).toBeDefined();

        const account = template.organizationSection.accounts[0];
        expect(resource).toBe(account);
    });

    test('Multiple accounts can be referenced using !Ref Array by Organizational Unit',
        () => {
            const organizationalUnit = template.organizationSection.organizationalUnits.find((x) => x.logicalId === 'OU2');
            expect(organizationalUnit.accounts.length).toBe(2);
            const resource1 = organizationalUnit.accounts[0].TemplateResource;
            const resource2 = organizationalUnit.accounts[1].TemplateResource;
            expect(resource1).toBeDefined();
            expect(resource2).toBeDefined();

            const account1 = template.organizationSection.accounts.find((x) => x === resource1);
            const account2 = template.organizationSection.accounts.find((x) => x === resource2);
            expect(account1).toBe(resource1);
            expect(account2).toBe(resource2);
        }
    );

    test(
        'Multiple service control policies can be referenced using !Ref Array by Organizational Unit',
        () => {
            const organizationalUnit = template.organizationSection.organizationalUnits.find((x) => x.logicalId === 'OU2');
            expect(organizationalUnit.serviceControlPolicies.length).toBe(2);
            const resource1 = organizationalUnit.serviceControlPolicies[0].TemplateResource;
            const resource2 = organizationalUnit.serviceControlPolicies[1].TemplateResource;
            expect(resource1).toBeDefined();
            expect(resource2).toBeDefined();

            const serviceControlPolicy1 = template.organizationSection.serviceControlPolicies.find((x) => x === resource1);
            const serviceControlPolicy2 = template.organizationSection.serviceControlPolicies.find((x) => x === resource2);
            expect(serviceControlPolicy1).toBe(resource1);
            expect(serviceControlPolicy2).toBe(resource2);
        }
    );
});

describe('when parsing organization section with references using Ref that don\'t resolve', () => {
    let contents: ITemplate;

    beforeEach(() => {
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
                        RootEmail: 'email@email.com',
                        ServiceControlPolicies: { Ref: 'Policy'},
                    } as IAccountProperties,
                },
                Account2: {
                    Type: OrgResourceTypes.Account,
                    Properties: {
                        RootEmail: 'email2@email.com',
                        AccountName: 'account2',
                    } as IAccountProperties,
                },
                Account3: {
                    Type: OrgResourceTypes.Account,
                    Properties: {
                        RootEmail: 'email3@email.com',
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

    test(
        'unknown account referenced using !Ref by Organizational Unit throws',
        () => {
            contents.Organization.OU2.Properties.Accounts.push( { Ref: 'non-existent-account' });
            expect(() => { new TemplateRoot(contents, './'); }).toThrowError(/non-existent-account/);
            expect(() => { new TemplateRoot(contents, './'); }).toThrowError(/OU2/);
        }
    );

    test(
        'unknown service control policy referenced using !Ref by Organizational Unit throws',
        () => {
            contents.Organization.OU.Properties.ServiceControlPolicies.Ref = 'non-existent';
            expect(() => { new TemplateRoot(contents, './'); }).toThrowError(/non-existent/);
            expect(() => { new TemplateRoot(contents, './'); }).toThrowError(/OU/);
        }
    );

    test('unknown service control policy referenced using !Ref by Account throws', () => {
            contents.Organization.Account.Properties.ServiceControlPolicies.Ref = 'unknown';
            expect(() => { new TemplateRoot(contents, './'); }).toThrowError(/unknown/);
            expect(() => { new TemplateRoot(contents, './'); }).toThrowError(/Account/);
        }
    );

    test('unknown service control policy referenced using !Ref by Organization Root throws', () => {
            contents.Organization.Root.Properties.ServiceControlPolicies.Ref = 'whatever';
            expect(() => { new TemplateRoot(contents, './'); }).toThrowError(/whatever/);
            expect(() => { new TemplateRoot(contents, './'); }).toThrowError(/Root/);
        }
    );

    test('unknown ou referenced using !Ref by Organization Unit throws', () => {
        contents.Organization.OU.Properties.OrganizationalUnits = { Ref: 'non-existent'};
        expect(() => { new TemplateRoot(contents, './'); }).toThrowError(/non-existent/);
    });

    test('circular ou referenced using !Ref throws', () => {
        contents.Organization.OU.Properties.OrganizationalUnits = { Ref: 'OU2'};
        contents.Organization.OU2.Properties.OrganizationalUnits = { Ref: 'OU'};
        expect(() => { new TemplateRoot(contents, './'); }).toThrowError(/circular/);
        expect(() => { new TemplateRoot(contents, './'); }).toThrowError(/OU2/);
        expect(() => { new TemplateRoot(contents, './'); }).toThrowError(/OU/);
    });

    test('ou referencing self using !Ref throws', () => {
        contents.Organization.OU.Properties.OrganizationalUnits = { Ref: 'OU'};
        expect(() => { new TemplateRoot(contents, './'); }).toThrowError(/reference to self/);
    });

});
