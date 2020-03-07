import { AwsOrganization } from "~aws-provider/aws-organization";
import { DefaultTemplateWriter, DefaultTemplate } from "~writer/default-template-writer";
import { ConsoleUtil } from "../../../src/console-util";

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


    test('template and state are defined', async () => {
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

        test('template will successfully be created', async () => {
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


    });

});