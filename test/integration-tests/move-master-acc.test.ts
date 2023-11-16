import { UpdateOrganizationCommand } from "~commands/index";
import { AwsOrganizationReader } from "~aws-provider/aws-organization-reader";
import { AwsOrganization } from "~aws-provider/aws-organization";
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, sleepForTest } from "./base-integration-test";
import { AwsUtil } from "~util/aws-util";
import { createWriteStream } from "fs";
import { OrganizationsClient } from "@aws-sdk/client-organizations";

const basePathForScenario = './test/integration-tests/resources/scenario-move-master-acc/';

describe('when moving master account around', () => {
    let context: IIntegrationTestContext;
    let orgClient: OrganizationsClient;

    let organizationAfterInit: AwsOrganization;
    let organizationAfterMove1: AwsOrganization;
    let organizationAfterMove2: AwsOrganization;
    let organizationAfterMove3: AwsOrganization;
    let masterAccountId: string;

    beforeAll(async () => {
        try{
            context = await baseBeforeAll();
            masterAccountId = await AwsUtil.GetMasterAccountId();
            orgClient = AwsUtil.GetOrganizationsService();

            await context.prepareStateBucket(basePathForScenario + 'state.json');
            const { command } = context;

            await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '1-init-organization.yml'});
            await sleepForTest(500);
            organizationAfterInit = new AwsOrganization(new AwsOrganizationReader(orgClient));
            await organizationAfterInit.initialize();
            await sleepForTest(500);

            await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '2-move-to-ou-organization.yml'});
            await sleepForTest(500);
            organizationAfterMove1 = new AwsOrganization(new AwsOrganizationReader(orgClient));
            await organizationAfterMove1.initialize();
            await sleepForTest(500);

            await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '3-move-to-other-ou-organization.yml'});
            await sleepForTest(500);
            organizationAfterMove2 = new AwsOrganization(new AwsOrganizationReader(orgClient));
            await organizationAfterMove2.initialize();
            await sleepForTest(500);

            await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '4-back-to-org-root-organization.yml'});
            await sleepForTest(500);
            organizationAfterMove3 = new AwsOrganization(new AwsOrganizationReader(orgClient));
            await organizationAfterMove3.initialize();
        } catch(err) {
            console.log(`caught exception`);
            console.log(err);
            expect(err.message).toBe('no error');
        }
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