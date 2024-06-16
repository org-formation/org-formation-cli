import { UpdateOrganizationCommand } from "~commands/index";
import { readFileSync } from "fs";
import { AwsOrganizationReader } from "~aws-provider/aws-organization-reader";
import { AwsOrganization } from "~aws-provider/aws-organization";
import { IIntegrationTestContext, baseBeforeAll, profileForIntegrationTests, baseAfterAll, sleepForTest } from "./base-integration-test";
import { AwsUtil } from "~util/aws-util";
import { OrganizationsClient } from "@aws-sdk/client-organizations";
import { CreateBucketCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const basePathForScenario = './test/integration-tests/resources/scenario-nested-ou/';


describe('when nesting ou\'s', () => {
    let context: IIntegrationTestContext;
    let orgClient: OrganizationsClient;

    let organizationAfterInit: AwsOrganization;
    let organizationAfterCreateParentChild: AwsOrganization;
    let organizationAfterSwapChildParent: AwsOrganization;
    let organizationAfterDeleteParentOfChild: AwsOrganization;
    let organizationAfterThreeLevelsDeep: AwsOrganization;
    let organizationAfterDuplicateNames: AwsOrganization;
    let organizationAfterCleanup: AwsOrganization;

    beforeAll(async () => {
        context = await baseBeforeAll();
        orgClient = AwsUtil.GetOrganizationsService()
        const command = {stateBucketName: context.stateBucketName, stateObject: 'state.json', profile: profileForIntegrationTests, verbose: true };

        try {
            await context.s3client.send(new CreateBucketCommand({ Bucket: context.stateBucketName }));
            await sleepForTest(200);
            await context.s3client.send(new PutObjectCommand({ Bucket: command.stateBucketName, Key: command.stateObject, Body: readFileSync(basePathForScenario + '0-state.json') }));

            await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '1-init-organization.yml'});
            await sleepForTest(500);
            organizationAfterInit = new AwsOrganization(new AwsOrganizationReader(orgClient));
            await organizationAfterInit.initialize();

            await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '2-create-parent-child-ou.yml'});
            await sleepForTest(500);
            organizationAfterCreateParentChild = new AwsOrganization(new AwsOrganizationReader(orgClient));
            await organizationAfterCreateParentChild.initialize();

            await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '3-swap-child-parent-ou.yml'});
            await sleepForTest(500);
            organizationAfterSwapChildParent = new AwsOrganization(new AwsOrganizationReader(orgClient));
            await organizationAfterSwapChildParent.initialize();

            await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '4-delete-parent-keep-child.yml'});
            await sleepForTest(500);
            organizationAfterDeleteParentOfChild = new AwsOrganization(new AwsOrganizationReader(orgClient));
            await organizationAfterDeleteParentOfChild.initialize();

            await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '7-cleanup-organization.yml'});
            await sleepForTest(500);
            organizationAfterCleanup = new AwsOrganization(new AwsOrganizationReader(orgClient));
            await organizationAfterCleanup.initialize();
        } catch(err) {
           // expect(err.message).toBe('');
        }
    })

    test('after init there is not parent, no child', async () => {
        const parentOrChild = organizationAfterInit.organizationalUnits.filter(x=>x.Name === 'child' || x.Name === 'parent');
        expect(parentOrChild.length).toBe(0);
    });

    test('after create parent and child both exists', async () => {
        const parentOrChild = organizationAfterCreateParentChild.organizationalUnits.filter(x=>x.Name === 'child' || x.Name === 'parent');
        expect(parentOrChild.length).toBe(2);
    });

    test('after create parent and child there is parent/child relationship', async () => {
        const parent = organizationAfterCreateParentChild.organizationalUnits.find(x=>x.Name === 'parent');
        expect(parent).toBeDefined();
        expect(parent.OrganizationalUnits.length).toBe(1);
        expect(parent.OrganizationalUnits[0].Name).toBe('child')
    });
    test('after swap parent with child relationship changed', async () => {
        const child = organizationAfterSwapChildParent.organizationalUnits.find(x=>x.Name === 'child');
        expect(child).toBeDefined();
        expect(child.OrganizationalUnits.length).toBe(1);
        expect(child.OrganizationalUnits[0].Name).toBe('parent')
    });

    test('after delete parent & keep child, parent is gone', async () => {
        // OU named child is deleted, which is was parent of OU named parent.
        const child = organizationAfterDeleteParentOfChild.organizationalUnits.find(x=>x.Name === 'child');
        expect(child).toBeUndefined();
        const parent = organizationAfterDeleteParentOfChild.organizationalUnits.find(x=>x.Name === 'parent');
        expect(parent).toBeDefined();
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