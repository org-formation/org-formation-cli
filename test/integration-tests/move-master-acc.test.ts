import { SharedIniFileCredentials, S3, Organizations } from "aws-sdk";
import { UpdateOrganizationCommand } from "~commands/index";
import { v4 } from "uuid";
import { readFileSync } from "fs";
import { AwsOrganizationReader } from "~aws-provider/aws-organization-reader";
import { AwsOrganization } from "~aws-provider/aws-organization";
import { AwsUtil } from "../../src/aws-util";

jest.setTimeout(99999999);

const profileForTests = 'org-formation-test-v2'
const basePathForScenario = './test/integration-tests/resources/scenario-move-master-acc/';


describe('when moving master account around', () => {
    const creds = new SharedIniFileCredentials({ profile: profileForTests });
    const s3client = new S3({ credentials: creds });
    const orgClient = new Organizations({ credentials: creds, region: 'us-east-1' });
    const bucketName = `${v4()}`;
    const command = {stateBucketName: bucketName, stateObject: 'state.json', profile: profileForTests, verbose: true };

    let organizationAfterInit: AwsOrganization;
    let organizationAfterMove1: AwsOrganization;
    let organizationAfterMove2: AwsOrganization;
    let organizationAfterMove3: AwsOrganization;
    let masterAccountId: string;

    beforeAll(async () => {
        await AwsUtil.InitializeWithProfile(profileForTests);

        masterAccountId = await AwsUtil.GetMasterAccountId();
        await s3client.createBucket({ Bucket: bucketName }).promise();
        await s3client.upload({ Bucket: command.stateBucketName, Key: command.stateObject, Body: readFileSync(basePathForScenario + '0-state.json') }).promise();

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
        const response = await s3client.listObjects({ Bucket: command.stateBucketName }).promise();
        const objectIdentifiers = response.Contents.map((x) => ({ Key: x.Key }));
        await s3client.deleteObjects({ Bucket: command.stateBucketName, Delete: { Objects: objectIdentifiers } }).promise();
        await s3client.deleteBucket({ Bucket: command.stateBucketName }).promise();
    });
})