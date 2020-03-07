import { AwsOrganization } from "~aws-provider/aws-organization";
import { DefaultTemplateWriter, DefaultTemplate } from "~writer/default-template-writer";
import { ConsoleUtil } from "../../../src/console-util";
import { TemplateRoot } from "~parser/parser";

describe('when writing template for organization', () => {
    let organization: AwsOrganization;
    let templateWriter: DefaultTemplateWriter;

    beforeEach(() => {
        organization = new AwsOrganization(undefined);
        jest.spyOn(organization, 'initialize').mockImplementation();
        organization.organization = {MasterAccountId: '111111111111'};
        organization.roots = [{ Id: 'o-root', Policies: [], OrganizationalUnits: [] }];
        organization.masterAccount = {Id: '111111111111', Name: 'Organization Master Account', ParentId: 'o-root', Policies: [], Type: 'Account'};
        organization.organizationalUnits = [];
        organization.accounts = [];
        organization.policies = [];
        templateWriter = new DefaultTemplateWriter(organization);
    })


    afterEach(()=> {
        jest.restoreAllMocks();
    })


    test('template and state are generated successfully', async () => {
        const defaultTemplate = await templateWriter.generateDefaultTemplate();
        expect(defaultTemplate.template).toBeDefined();
        expect(defaultTemplate.state).toBeDefined();
    })

    describe('and multiple accounts have the same name', () => {

        let consoleWarnMock: jest.SpyInstance;

        beforeEach(() => {
            organization.accounts = [
                {Name: 'abcdef', Id: '123123123123', Type: 'Account', ParentId: 'o-root', Policies: []},
                {Name: 'abcdef', Id: '234234234234', Type: 'Account', ParentId: 'o-root', Policies: []},
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
            const root: TemplateRoot = TemplateRoot.createFromContents(defaultTemplate.template);
            expect(root.organizationSection.accounts).toBeDefined();
            expect(root.organizationSection.accounts.length).toBe(2);
        });
    });

    describe('and account has same name as organizational unit', () => {
        beforeEach(() => {
            organization.accounts = [
                {Name: 'abcdef', Id: '123123123123', Type: 'Account', ParentId: 'o-root', Policies: []},
            ];

            organization.organizationalUnits = [
                {Name: 'abcdef', Type: 'OrganizationalUnit', Id: 'ou-1', ParentId: 'o-root', Policies: [], Accounts: [], OrganizationalUnits: []}
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
                {Name: 'abcdef', Type: 'OrganizationalUnit', Id: 'ou-1', ParentId: 'o-root', Policies: [], Accounts: [], OrganizationalUnits: []},
                {Name: 'abcdef', Type: 'OrganizationalUnit', Id: 'ou-2', ParentId: 'o-root', Policies: [], Accounts: [], OrganizationalUnits: []}
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

            const parent = root.organizationSection.organizationalUnits.find(x=>x.organizationalUnits.length > 0);
            expect(parent).toBeDefined();
            expect(parent.organizationalUnits?.length).toBe(1)
        })

    });
});