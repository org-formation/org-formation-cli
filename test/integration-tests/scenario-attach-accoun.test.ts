import { Organizations } from "aws-sdk";
import { UpdateOrganizationCommand } from "~commands/index";
import { readFileSync } from "fs";
import { AwsUtil } from "../../src/aws-util";
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, profileForIntegrationTests } from "./base-integration-test";
import { ConsoleUtil } from "../../src/console-util";

const basePathForScenario = './test/integration-tests/resources/scenario-attach-account/';

describe('when attaching and detaching account', () => {
    let context: IIntegrationTestContext;
    let orgClient: Organizations;

    let consoleOutAfterInit: jest.MockContext<any, any>;
    let consoleOutAfterAttachAccount: jest.MockContext<any, any>;
    let consoleOutAfterDetachAccount: jest.MockContext<any, any>;
    let logOut: jest.SpyInstance;

    beforeAll(async () => {

        logOut = jest.spyOn(ConsoleUtil, 'Out');

        context = await baseBeforeAll();
        orgClient = new Organizations({ credentials: context.creds, region: 'us-east-1' });
        const command = {stateBucketName: context.stateBucketName, stateObject: 'state.json', profile: profileForIntegrationTests, verbose: true };

        await context.s3client.createBucket({ Bucket: context.stateBucketName }).promise();
        await context.s3client.upload({ Bucket: command.stateBucketName, Key: command.stateObject, Body: readFileSync(basePathForScenario + 'state.json') }).promise();

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