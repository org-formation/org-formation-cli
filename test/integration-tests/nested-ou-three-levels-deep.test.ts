import { UpdateOrganizationCommand } from "~commands/index";
import { readFileSync } from "fs";
import { AwsOrganizationReader } from "~aws-provider/aws-organization-reader";
import { AwsOrganization } from "~aws-provider/aws-organization";
import { IIntegrationTestContext, baseBeforeAll, profileForIntegrationTests, baseAfterAll, sleepForTest } from "./base-integration-test";
import { CreateBucketCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { AwsUtil } from "~util/aws-util";
import { OrganizationsClient } from "@aws-sdk/client-organizations";

const basePathForScenario = './test/integration-tests/resources/scenario-nested-ou/';


describe('when nesting ou\'s', () => {
    let context: IIntegrationTestContext;
    let orgClient: OrganizationsClient;

    let organizationAfterInit: AwsOrganization;
    let organizationAfterThreeLevelsDeep: AwsOrganization;
    let organizationAfterDuplicateNames: AwsOrganization;
    let organizationAfterCleanup: AwsOrganization;

    beforeAll(async () => {
        context = await baseBeforeAll();
        orgClient = AwsUtil.GetOrganizationsService()
        const command = {stateBucketName: context.stateBucketName, stateObject: 'state.json', profile: profileForIntegrationTests, verbose: true };

        await context.s3client.send(new CreateBucketCommand({ Bucket: context.stateBucketName }));
        await sleepForTest(200);
        await context.s3client.send(new PutObjectCommand({ Bucket: command.stateBucketName, Key: command.stateObject, Body: readFileSync(basePathForScenario + '0-state.json') }));

        await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '1-init-organization.yml'});
        await sleepForTest(500);
        organizationAfterInit = new AwsOrganization(new AwsOrganizationReader(orgClient));
        await organizationAfterInit.initialize();

        await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '5-three-levels-deep.yml'});
        await sleepForTest(500);
        organizationAfterThreeLevelsDeep = new AwsOrganization(new AwsOrganizationReader(orgClient));
        await organizationAfterThreeLevelsDeep.initialize();

        await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '7-cleanup-organization.yml'});
        await sleepForTest(500);
        organizationAfterCleanup = new AwsOrganization(new AwsOrganizationReader(orgClient));
        await organizationAfterCleanup.initialize();
    
    })

    test('after three levels deep', async () => {
        const parent = organizationAfterThreeLevelsDeep.organizationalUnits.find(x=>x.Name === 'parent');
        expect(parent).toBeDefined();
        expect(parent.OrganizationalUnits.length).toBe(1);
        expect(parent.OrganizationalUnits[0].Name).toBe('middle')

        const middle = organizationAfterThreeLevelsDeep.organizationalUnits.find(x=>x.Name === 'middle');
        expect(middle).toBeDefined();
        expect(middle.OrganizationalUnits.length).toBe(2);

        const childNames = middle.OrganizationalUnits.map(x=>x.Name);
        expect(childNames.includes('child1')).toBeTruthy();
        expect(childNames.includes('child2')).toBeTruthy();
    });

    // test('after duplicate names, there are three ou\'s called child', async () => {
    //     // OU named child is deleted, which is was parent of OU named parent.
    //     const child = organizationAfterDuplicateNames.organizationalUnits.filter(x=>x.Name === 'child');
    //     expect(child).toBeUndefined();
    //     expect(child.length).toBe(3);
    // });

    test('after cleanup both are gone', async () => {
        // OU named child is deleted, which is was parent of OU named parent.
        const parentOrChild = organizationAfterCleanup.organizationalUnits.filter(x=>x.Name === 'child' || x.Name === 'parent');
        expect(parentOrChild.length).toBe(0);
    });

    afterAll(async () => {
        await baseAfterAll(context);
    });
})