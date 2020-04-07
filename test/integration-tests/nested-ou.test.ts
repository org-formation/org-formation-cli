import { Organizations } from "aws-sdk";
import { UpdateOrganizationCommand } from "~commands/index";
import { readFileSync } from "fs";
import { AwsOrganizationReader } from "~aws-provider/aws-organization-reader";
import { AwsOrganization } from "~aws-provider/aws-organization";
import { IIntegrationTestContext, baseBeforeAll, profileForIntegrationTests, baseAfterAll } from "./base-integration-test";

const basePathForScenario = './test/integration-tests/resources/scenario-nested-ou/';


describe('when nesting ou\'s', () => {
    let context: IIntegrationTestContext;
    let orgClient: Organizations;

    let organizationAfterInit: AwsOrganization;
    let organizationAfterCreateParentchild: AwsOrganization;
    let organizationAfterSwapChildParent: AwsOrganization;
    let organizationAfterDeleteParentOfChild: AwsOrganization;
    let organizationAfterCleanup: AwsOrganization;

    beforeAll(async () => {
        context = await baseBeforeAll();
        orgClient = new Organizations({ region: 'us-east-1' });
        const command = {stateBucketName: context.stateBucketName, stateObject: 'state.json', profile: profileForIntegrationTests, verbose: true };

        await context.s3client.createBucket({ Bucket: context.stateBucketName }).promise();
        await context.s3client.upload({ Bucket: command.stateBucketName, Key: command.stateObject, Body: readFileSync(basePathForScenario + '0-state.json') }).promise();

        await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '1-init-organization.yml'});
        organizationAfterInit = new AwsOrganization(new AwsOrganizationReader(orgClient));
        await organizationAfterInit.initialize();

        await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '2-create-parent-child-ou.yml'});
        organizationAfterCreateParentchild = new AwsOrganization(new AwsOrganizationReader(orgClient));
        await organizationAfterCreateParentchild.initialize();

        await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '3-swap-child-parent-ou.yml'});
        organizationAfterSwapChildParent = new AwsOrganization(new AwsOrganizationReader(orgClient));
        await organizationAfterSwapChildParent.initialize();

        await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '4-delete-parent-keep-child.yml'});
        organizationAfterDeleteParentOfChild = new AwsOrganization(new AwsOrganizationReader(orgClient));
        await organizationAfterDeleteParentOfChild.initialize();

        await UpdateOrganizationCommand.Perform({...command, templateFile: basePathForScenario + '5-cleanup-organization.yml'});
        organizationAfterCleanup = new AwsOrganization(new AwsOrganizationReader(orgClient));
        await organizationAfterCleanup.initialize();
    })

    test('after init there is not parent, no child', async () => {
        const parentOrChild = organizationAfterInit.organizationalUnits.filter(x=>x.Name === 'child' || x.Name === 'parent');
        expect(parentOrChild.length).toBe(0);
    });

    test('after create parent and child both exists', async () => {
        const parentOrChild = organizationAfterCreateParentchild.organizationalUnits.filter(x=>x.Name === 'child' || x.Name === 'parent');
        expect(parentOrChild.length).toBe(2);
    });

    test('after create parent and child there is parent/child relationship', async () => {
        const parent = organizationAfterCreateParentchild.organizationalUnits.find(x=>x.Name === 'parent');
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