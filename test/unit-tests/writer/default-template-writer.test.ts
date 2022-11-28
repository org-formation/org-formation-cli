import { AwsOrganization } from "~aws-provider/aws-organization";
import { DefaultTemplateWriter, DefaultTemplate, ITemplateGenerationSettings } from "~writer/default-template-writer";
import { ConsoleUtil } from "~util/console-util";
import { TemplateRoot } from "~parser/parser";
import { DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS } from "~util/aws-util";

describe('when writing template for organization', () => {
    let organization: AwsOrganization;
    let templateWriter: DefaultTemplateWriter;

    beforeEach(() => {
        organization = new AwsOrganization(undefined);
        jest.spyOn(organization, 'initialize').mockImplementation();
        organization.organization = { MasterAccountId: '111111111111' };
        organization.roots = [{ Id: 'o-root', Policies: [], OrganizationalUnits: [] }];
        organization.masterAccount = { Id: '111111111111', Name: 'Organization Master Account', ParentId: 'o-root', Email: 'email@someplace.com', Policies: [], Type: 'Account', Tags: { key: 'val' } };
        organization.organizationalUnits = [];
        organization.accounts = [];
        organization.policies = [];
        templateWriter = new DefaultTemplateWriter(organization);
    })

    afterEach(() => {
        jest.restoreAllMocks();
    })

    test('template and state are generated successfully', async () => {
        const defaultTemplate = await templateWriter.generateDefaultTemplate();
        expect(defaultTemplate.template).toBeDefined();
        expect(defaultTemplate.state).toBeDefined();
    })

    describe('and organization has accounts, ou\'s and scp\'s', () => {
        beforeEach(() => {
            organization.accounts = [
                { Name: 'acc', Type: 'Account', Id: '123123123123', ParentId: 'ou-1', Policies: [] },
                { Name: 'acc-with-dash', Type: 'Account', Id: '123123123124', ParentId: 'o-root', Policies: [] },
                { Name: 'acc with spaces', Type: 'Account', Id: '123123123125', ParentId: 'o-root', Policies: [] },
            ];
            organization.organizationalUnits = [
                { Name: 'ou', Type: 'OrganizationalUnit', Id: 'ou-1', ParentId: 'o-root', Policies: [], Accounts: [], OrganizationalUnits: [] }
            ];
            organization.policies = [
                { Name: 'scp-aws-managed', Type: 'Policy', Id: 'scp-0', PolicySummary: { AwsManaged: true }, Content: '{}', Targets: [] },
                { Name: 'scp', Type: 'Policy', Id: 'scp-1', PolicySummary: { AwsManaged: false }, Content: '{}', Targets: [] },
            ];

            organization.organizationalUnits[0].Accounts.push(organization.accounts[0]);
            organization.organizationalUnits[0].Policies.push(organization.policies[1]);
        })

        test('template and state are generated successfully', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            expect(defaultTemplate.template).toBeDefined();
            expect(defaultTemplate.state).toBeDefined();
        })

        test('generated template contains accounts', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            const root = TemplateRoot.createFromContents(defaultTemplate.template);
            expect(root.organizationSection.accounts?.length).toBe(3);
        });

        test('generated template contains master account', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            const root = TemplateRoot.createFromContents(defaultTemplate.template);
            expect(root.organizationSection.masterAccount).toBeDefined();
        });

        test('generated template contains master account tags', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            const root = TemplateRoot.createFromContents(defaultTemplate.template);
            expect(root.organizationSection.masterAccount).toBeDefined();
            expect(root.organizationSection.masterAccount.tags).toBeDefined();
        });

        test('generated template contains master account email', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            const root = TemplateRoot.createFromContents(defaultTemplate.template);
            expect(root.organizationSection.masterAccount).toBeDefined();
            expect(root.organizationSection.masterAccount.rootEmail).toBeDefined();
        });

        test('generated template contains CrossAccountRoleName', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            const root = TemplateRoot.createFromContents(defaultTemplate.template);
            expect(root.organizationSection.organizationRoot?.defaultOrganizationAccessRoleName).toBe('OrganizationAccountAccessRole');
        });

        test('generated template contains overridden CrossAccountRoleName', async () => {
            DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS.RoleName = 'xyz';
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            const root = TemplateRoot.createFromContents(defaultTemplate.template);
            expect(root.organizationSection.organizationRoot?.defaultOrganizationAccessRoleName).toBe('xyz');
            DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS.RoleName = 'OrganizationAccountAccessRole';
        });

        test('generated template does not contains BuildAccessRoleName', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            const root = TemplateRoot.createFromContents(defaultTemplate.template);
            expect(root.organizationSection.organizationRoot?.defaultBuildAccessRoleName).toBeUndefined();
        });
        test('generated template does contains overriden BuildAccessRoleName', async () => {
            templateWriter.DefaultBuildProcessAccessRoleName = 'OneTwoThree'
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            const root = TemplateRoot.createFromContents(defaultTemplate.template);
            expect(root.organizationSection.organizationRoot?.defaultBuildAccessRoleName).toBe('OneTwoThree');
        });
        test('generated template contains organizational unit', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            const root = TemplateRoot.createFromContents(defaultTemplate.template);
            expect(root.organizationSection.organizationalUnits?.length).toBe(1);
        });

        test('generated template contains organizational unit to account relationship', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            const root = TemplateRoot.createFromContents(defaultTemplate.template);
            const ou = root.organizationSection.organizationalUnits[0];
            expect(ou.accounts?.length).toBe(1);
            expect(ou.accounts[0].TemplateResource.logicalId).toBe(root.organizationSection.accounts[0].logicalId);
        });

        test('generated template contains organizational unit to scp relationship', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            const root = TemplateRoot.createFromContents(defaultTemplate.template);
            const ou = root.organizationSection.organizationalUnits[0];
            expect(ou.serviceControlPolicies?.length).toBe(1);
            expect(ou.serviceControlPolicies[0].TemplateResource.logicalId).toBe(root.organizationSection.serviceControlPolicies[0].logicalId);
        });

        test('generated template only contains non AWS managed service control policy', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            const root = TemplateRoot.createFromContents(defaultTemplate.template);
            expect(root.organizationSection.serviceControlPolicies?.length).toBe(1);
            expect(root.organizationSection.serviceControlPolicies[0].policyName).toBe('scp');
        });

        test('generated template does not contain dashes in account names', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            const root = TemplateRoot.createFromContents(defaultTemplate.template);
            const accountWithDashes = root.organizationSection.accounts.find(x => x.accountName === "acc-with-dash");
            expect(accountWithDashes).toBeDefined();
            expect(accountWithDashes.logicalId).toBe("AccWithDashAccount")
        });

        test('generated template does not contain spaces in account names', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            const root = TemplateRoot.createFromContents(defaultTemplate.template);
            const accountWithDashes = root.organizationSection.accounts.find(x => x.accountName === "acc with spaces");
            expect(accountWithDashes).toBeDefined();
            expect(accountWithDashes.logicalId).toBe("AccWithSpacesAccount")
        });
    });

    describe('and multiple accounts have the same name', () => {

        let consoleWarnMock: jest.SpyInstance;

        beforeEach(() => {
            organization.accounts = [
                { Name: 'abcdef', Id: '123123123123', Type: 'Account', ParentId: 'o-root', Policies: [] },
                { Name: 'abcdef', Id: '234234234234', Type: 'Account', ParentId: 'o-root', Policies: [] },
            ];

            consoleWarnMock = jest.spyOn(ConsoleUtil, 'LogWarning').mockImplementation();
        })

        test('template and state are generated successfully', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            expect(defaultTemplate.template).toBeDefined();
            expect(defaultTemplate.state).toBeDefined();
        })

        test('warning was logged', async () => {
            await templateWriter.generateDefaultTemplate();
            expect(consoleWarnMock).toHaveBeenCalledTimes(1);
            expect(consoleWarnMock).toHaveBeenCalledWith(expect.stringContaining('confusing'));
            expect(consoleWarnMock).toHaveBeenCalledWith(expect.stringContaining('abcdef'));
        })

        test('generated template contains both accounts', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            const root = TemplateRoot.createFromContents(defaultTemplate.template);
            expect(root.organizationSection.accounts).toBeDefined();
            expect(root.organizationSection.accounts.length).toBe(2);
        });
    });

    describe('and account has same name as organizational unit', () => {
        beforeEach(() => {
            organization.accounts = [
                { Name: 'abcdef', Id: '123123123123', Type: 'Account', ParentId: 'o-root', Policies: [] },
            ];

            organization.organizationalUnits = [
                { Name: 'abcdef', Type: 'OrganizationalUnit', Id: 'ou-1', ParentId: 'o-root', Policies: [], Accounts: [], OrganizationalUnits: [] }
            ];
        })

        test('template and state are generated successfully', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            expect(defaultTemplate.template).toBeDefined();
            expect(defaultTemplate.state).toBeDefined();
        })

        test('generated template contains ou', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            const root: TemplateRoot = TemplateRoot.createFromContents(defaultTemplate.template);
            expect(root.organizationSection.organizationalUnits).toBeDefined();
            expect(root.organizationSection.organizationalUnits.length).toBe(1);
        });

        test('generated template contains account', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            const root: TemplateRoot = TemplateRoot.createFromContents(defaultTemplate.template);
            expect(root.organizationSection.accounts).toBeDefined();
            expect(root.organizationSection.accounts.length).toBe(1);
        });
    });

    describe('and multiple organizational units have the same name', () => {

        beforeEach(() => {

            organization.organizationalUnits = [
                { Name: 'abcdef', Type: 'OrganizationalUnit', Id: 'ou-1', ParentId: 'o-root', Policies: [], Accounts: [], OrganizationalUnits: [] },
                { Name: 'abcdef', Type: 'OrganizationalUnit', Id: 'ou-2', ParentId: 'o-root', Policies: [], Accounts: [], OrganizationalUnits: [] }
            ];
            organization.organizationalUnits[0].OrganizationalUnits.push(organization.organizationalUnits[1])
        })

        test('template and state are generated successfully', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            expect(defaultTemplate.template).toBeDefined();
            expect(defaultTemplate.state).toBeDefined();
        })

        test('generated template contains parent/child relationship', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            const root: TemplateRoot = TemplateRoot.createFromContents(defaultTemplate.template);
            expect(root.organizationSection.organizationalUnits).toBeDefined();
            expect(root.organizationSection.organizationalUnits.length).toBe(2);
            expect(root.organizationSection.organizationalUnits.length).toBe(2);

            const parent = root.organizationSection.organizationalUnits.find(x => x.organizationalUnits.length > 0);
            expect(parent).toBeDefined();
            expect(parent.organizationalUnits?.length).toBe(1)
        })

    });

    describe('and multiple organizational units have the same name', () => {

        beforeEach(() => {

            organization.organizationalUnits = [
                { Name: 'abcdef', Type: 'OrganizationalUnit', Id: 'ou-1', ParentId: 'o-root', Policies: [], Accounts: [], OrganizationalUnits: [] },
                { Name: 'abcdef', Type: 'OrganizationalUnit', Id: 'ou-2', ParentId: 'o-root', Policies: [], Accounts: [], OrganizationalUnits: [] }
            ];
            organization.organizationalUnits[0].OrganizationalUnits.push(organization.organizationalUnits[1])
        })

        test('template and state are generated successfully', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            expect(defaultTemplate.template).toBeDefined();
            expect(defaultTemplate.state).toBeDefined();
        })

        test('generated template contains parent/child relationship', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            const root: TemplateRoot = TemplateRoot.createFromContents(defaultTemplate.template);
            expect(root.organizationSection.organizationalUnits).toBeDefined();
            expect(root.organizationSection.organizationalUnits.length).toBe(2);
            expect(root.organizationSection.organizationalUnits.length).toBe(2);

            const parent = root.organizationSection.organizationalUnits.find(x => x.organizationalUnits.length > 0);
            expect(parent).toBeDefined();
            expect(parent.organizationalUnits?.length).toBe(1)
        })

    });

    describe('and master account is contained in OU', () => {

        beforeEach(() => {

            organization.organizationalUnits = [
                { Name: 'ou', Type: 'OrganizationalUnit', Id: 'ou-1', ParentId: 'o-root', Policies: [], Accounts: [], OrganizationalUnits: [] }
            ];
            organization.organizationalUnits[0].Accounts.push(organization.masterAccount);
        })


        test('generated template contains organizational unit', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            const root = TemplateRoot.createFromContents(defaultTemplate.template);
            expect(root.organizationSection.organizationalUnits?.length).toBe(1);
        });

        test('generated template contains organizational unit to master account relationship', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate();
            const root = TemplateRoot.createFromContents(defaultTemplate.template);
            const ou = root.organizationSection.organizationalUnits[0];
            expect(ou.accounts?.length).toBe(1);
            expect(ou.accounts[0].TemplateResource.logicalId).toBe(root.organizationSection.masterAccount.logicalId);
        });

    });

    describe('and generated is supplied with predefined accounts', () => {
        const settings: ITemplateGenerationSettings = {
            predefinedOUs: [],
            predefinedAccounts:
                [{
                    id: "123123123123",
                    logicalName: "LogicalName",
                    properties: {
                        AccountName: "Security Account",
                        Tags: {
                            "budget-alarm-threshold": 200 as unknown as string,
                            "budget-alarm-threshold-email-recipient": "zzzzz"
                        }
                    }
                }]
        }
        test('generated template contains predefined account', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate(settings);
            const root = TemplateRoot.createFromContents(defaultTemplate.template);
            expect(root.organizationSection.accounts?.length).toBe(1);
            expect(root.organizationSection.accounts[0].logicalId).toBe("LogicalName");
            expect(Object.entries(root.organizationSection.accounts[0].tags).length).toBe(2);
        });
    });
    describe('and predefined account already exists', () => {
        const settings: ITemplateGenerationSettings = {
            predefinedOUs: [],
            predefinedAccounts:
                [{
                    id: "123123123123",
                    logicalName: "LogicalName",
                    properties: {
                        AccountName: "Security Account",
                        Tags: {
                            "budget-alarm-threshold": 200 as unknown as string,
                            "budget-alarm-threshold-email-recipient": "zzzzz"
                        }
                    }
                }]
        }
        beforeEach(() => {
            organization.accounts = [
                { Name: 'abcdef', Id: '123123123123', Type: 'Account', ParentId: 'o-root', Policies: [] },
            ];
        })

        test('generated template contains merged account', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate(settings);
            const root = TemplateRoot.createFromContents(defaultTemplate.template);
            expect(root.organizationSection.accounts?.length).toBe(1);
            expect(root.organizationSection.accounts[0].logicalId).toBe("LogicalName");
            expect(root.organizationSection.accounts[0].accountName).toBe("abcdef");
            expect(Object.entries(root.organizationSection.accounts[0].tags).length).toBe(2);
        });
    });
    describe('and generate is supplied with predefined OUs', () => {
        const settings: ITemplateGenerationSettings = {
            predefinedOUs: [{
                logicalName: "SharedOU",
                id: "o-123",
                properties:
                {
                    OrganizationalUnitName: "shared",
                    Accounts: ["!Ref LogicalName"]
                }
            }],
            predefinedAccounts:
                [{
                    id: "123123123123",
                    logicalName: "LogicalName",
                    properties: {
                        AccountName: "Security Account",
                        Tags: {
                            "budget-alarm-threshold": 200 as unknown as string,
                            "budget-alarm-threshold-email-recipient": "zzzzz"
                        }
                    }
                }]
        }
        test('generated template contains predefined ou', async () => {
            const defaultTemplate = await templateWriter.generateDefaultTemplate(settings);
            const root = TemplateRoot.createFromContents(defaultTemplate.template);
            expect(root.organizationSection.organizationalUnits?.length).toBe(1);
            expect(root.organizationSection.organizationalUnits[0].logicalId).toBe("SharedOU");
            expect(root.organizationSection.organizationalUnits[0].accounts.length).toBe(1);
            expect(root.organizationSection.organizationalUnits[0].accounts[0].TemplateResource.accountId).toBe("123123123123");
            // expect(Object.entries(root.organizationSection.accounts[0].tags).length).toBe(2);
        });
    });
});