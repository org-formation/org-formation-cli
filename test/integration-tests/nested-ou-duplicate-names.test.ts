import { Organizations } from "aws-sdk";
import { UpdateOrganizationCommand } from "~commands/index";
import { readFileSync } from "fs";
import { AwsOrganizationReader } from "~aws-provider/aws-organization-reader";
import { AwsOrganization } from "~aws-provider/aws-organization";
import { IIntegrationTestContext, baseBeforeAll, profileForIntegrationTests, baseAfterAll, sleepForTest } from "./base-integration-test";

const basePathForScenario = './test/integration-tests/resources/scenario-nested-ou/';


describe('when nesting ou\'s', () => {
    let context: IIntegrationTestContext;
    let orgClient: Organizations;

    let organizationAfterInit: AwsOrganization;
    let organizationAfterDuplicateNames: AwsOrganization;
    let organizationAfterCleanup: AwsOrganization;

    beforeAll(async () => {
        context = await baseBeforeAll();
        orgClient = new Organizations({ region: 'us-east-1' });
        const command = {stateBucketName: context.stateBucketName, stateObject: 'state.json', profile: profileForIntegrationTests, verbose: true };

        try {
            await context.s3client.createBucket({ Bucket: context.stateBucketName }).promise();
            await sleepForTest(200);
            await context.s3client.upload({ Bucket: command.stateBucketName, Key: command.stateObject, Body: readFileSync(basePathForScenario + '0-state.json') }).promise();

            await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '1-init-organization.yml'});
            await sleepForTest(500);
            organizationAfterInit = new AwsOrganization(new AwsOrganizationReader(orgClient));
            await organizationAfterInit.initialize();

            await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '6-duplicate-names.yml'});
            await sleepForTest(500);
            organizationAfterDuplicateNames = new AwsOrganization(new AwsOrganizationReader(orgClient));
            await organizationAfterDuplicateNames.initialize();

            await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '7-cleanup-organization.yml'});
            await sleepForTest(500);
            organizationAfterCleanup = new AwsOrganization(new AwsOrganizationReader(orgClient));
            await organizationAfterCleanup.initialize();

        } catch(err) {
            expect(err.message).toBe('');
        }
    })

    test('after duplicate names, there are three ou\'s called child', async () => {
        // OU named child is deleted, which is was parent of OU named parent.
        const child = organizationAfterDuplicateNames.organizationalUnits.filter(x=>x.Name === 'child');
        expect(child).toBeDefined();
        expect(child.length).toBe(3);
    });

    test('after cleanup both are gone', async () => {
        // OU named child is deleted, which is was parent of OU named parent.
        const parentOrChild = organizationAfterCleanup.organizationalUnits.filter(x=>x.Name === 'child' || x.Name === 'parent');
        expect(parentOrChild.length).toBe(0);
    });

    afterAll(async () => {
        await baseAfterAll(context);
    });
})