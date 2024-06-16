import { PerformTasksCommand } from "~commands/index";
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll } from "./base-integration-test";
import { ConsoleUtil } from "~util/console-util";
import { OrganizationsClient } from "@aws-sdk/client-organizations";
import { AwsUtil } from "~util/aws-util";

const basePathForScenario = './test/integration-tests/resources/scenario-annotate-organization/';

describe('when deploying stack to non-managed organization', () => {
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
        const { command } = context;

        await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-deploy.yml'});
        consoleOutAfterInit = logOut.mock;
        logOut.mockReset();
    })

    test('after init organization no attach, not detach is logged', () => {
        expect(consoleOutAfterInit.calls).toBeDefined();
    });

    afterAll(async () => {
        logOut.mockRestore();
        await baseAfterAll(context);
    });
});