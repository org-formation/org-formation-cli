import { Organizations } from "aws-sdk";
import { UpdateOrganizationCommand } from "~commands/index";
import { readFileSync } from "fs";
import { AwsOrganizationReader } from "~aws-provider/aws-organization-reader";
import { AwsOrganization } from "~aws-provider/aws-organization";
import { AwsUtil } from "../../src/aws-util";
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, profileForTests } from "./base-integration-test";

const basePathForScenario = './test/integration-tests/resources/scenario-move-master-acc/';


describe('when moving master account around', () => {
    let context: IIntegrationTestContext;
    let orgClient: Organizations;

    let organizationAfterInit: AwsOrganization;
    let organizationAfterMove1: AwsOrganization;
    let organizationAfterMove2: AwsOrganization;
    let organizationAfterMove3: AwsOrganization;
    let masterAccountId: string;

    beforeAll(async () => {

        context = await baseBeforeAll();
        orgClient = new Organizations({ credentials: context.creds, region: 'us-east-1' });
        const command = {stateBucketName: context.stateBucketName, stateObject: 'state.json', profile: profileForTests, verbose: true };

        masterAccountId = await AwsUtil.GetMasterAccountId();
        await context.s3client.createBucket({ Bucket: context.stateBucketName }).promise();
        await context.s3client.upload({ Bucket: command.stateBucketName, Key: command.stateObject, Body: readFileSync(basePathForScenario + '0-state.json') }).promise();

        await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '1-init-organization.yml'});
        organizationAfterInit = new AwsOrganization(new AwsOrganizationReader(orgClient));
        await organizationAfterInit.initialize();

        await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '2-move-to-ou-organization.yml'});
        organizationAfterMove1 = new AwsOrganization(new AwsOrganizationReader(orgClient));
        await organizationAfterMove1.initialize();

        await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '3-move-to-other-ou-organization.yml'});
        organizationAfterMove2 = new AwsOrganization(new AwsOrganizationReader(orgClient));
        await organizationAfterMove2.initialize();

        await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '4-back-to-org-root-organization.yml'});
        organizationAfterMove3 = new AwsOrganization(new AwsOrganizationReader(orgClient));
        await organizationAfterMove3.initialize();
    })

    test('after init the master account is not within an OU', async () => {
        const ouWithMaster = organizationAfterInit.organizationalUnits.find(x=>x.Accounts.find(y=>y.Id === masterAccountId));
        expect(ouWithMaster).toBeUndefined();
    });

    test('after move1 the master account is within OU 1', async () => {
        const ouWithMaster = organizationAfterMove1.organizationalUnits.find(x=>x.Accounts.find(y=>y.Id === masterAccountId));
        expect(ouWithMaster).toBeDefined();
        expect(ouWithMaster.Name).toBe('ou1')
    });

    test('after move2 the master account is within OU 2', async () => {
        const ouWithMaster = organizationAfterMove2.organizationalUnits.find(x=>x.Accounts.find(y=>y.Id === masterAccountId));
        expect(ouWithMaster).toBeDefined();
        expect(ouWithMaster.Name).toBe('ou2')
    });

    test('after move3 the master account is not within an OU', async () => {
        const ouWithMaster = organizationAfterMove3.organizationalUnits.find(x=>x.Accounts.find(y=>y.Id === masterAccountId));
        expect(ouWithMaster).toBeUndefined();
    });

    afterAll(async () => {
        await baseAfterAll(context);
    });
})