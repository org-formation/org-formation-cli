import { UpdateOrganizationCommand } from "~commands/index";
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll } from "./base-integration-test";
import { ConsoleUtil } from "~util/console-util";
import { OrganizationsClient } from "@aws-sdk/client-organizations";
import { AwsUtil } from "~util/aws-util";

const basePathForScenario = './test/integration-tests/resources/scenario-attach-account/';

describe('when attaching and detaching account', () => {
    let context: IIntegrationTestContext;
    let orgClient: OrganizationsClient;

    let consoleOutAfterInit: jest.MockContext<any, any>;
    let consoleOutAfterAttachAccount: jest.MockContext<any, any>;
    let consoleOutAfterDetachAccount: jest.MockContext<any, any>;
    let logOut: jest.SpyInstance;

    beforeAll(async () => {

        logOut = jest.spyOn(ConsoleUtil, 'Out');

        context = await baseBeforeAll();
        orgClient = AwsUtil.GetOrganizationsService()
        await context.prepareStateBucket(basePathForScenario + 'state.json');
        const { command } = context;

        await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '1-init-organization.yml'});
        consoleOutAfterInit = logOut.mock;
        logOut.mockReset();

        await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '2-attach-organization.yml'});
        consoleOutAfterAttachAccount = logOut.mock;
        logOut.mockReset();

        await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '3-detach-organization.yml'});
        consoleOutAfterDetachAccount = logOut.mock;
        logOut.mockReset();
    })

    test('after init organization no attach, not detach is logged', () => {
        expect(consoleOutAfterInit.calls).toBeDefined();

    });

    test('after attach account, attach logged', () => {
        expect(consoleOutAfterAttachAccount.calls).toBeDefined();
        expect(consoleOutAfterAttachAccount.calls.find(x=>expect.stringContaining('Create (340381375986)'))).toBeDefined();
    });

    test('after detach account, detach logged', () => {
        expect(consoleOutAfterDetachAccount.calls).toBeDefined();
        expect(consoleOutAfterDetachAccount.calls.find(x=>expect.stringContaining('Forget'))).toBeDefined();
    });

    afterAll(async () => {
        logOut.mockRestore();
        await baseAfterAll(context);
    });
});