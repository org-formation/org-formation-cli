
import { unlinkSync } from 'fs';
import { v4 } from 'uuid';
import { InitOrganizationCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, profileForIntegrationTests } from './base-integration-test';
import { TemplateRoot } from '~parser/parser';
import { GetBucketEncryptionCommand, GetBucketLocationCommand, GetObjectCommand, GetPublicAccessBlockCommand } from '@aws-sdk/client-s3';

describe('when calling org-formation init', () => {
    let context: IIntegrationTestContext;
    const templatePath = `./test/integration-tests/temp/${v4()}.yml`;

    beforeAll(async () => {
        context = await baseBeforeAll();
        const command = { stateBucketName: context.stateBucketName, crossAccountRoleName: 'MyCrossAccountRole', stateObject: 'state.json', profile: profileForIntegrationTests, verbose: true, region: 'eu-west-1' };

        await InitOrganizationCommand.Perform({ ...command, file: templatePath })
    });

    test('creates bucket in the right region', async () => {
        const response = await context.s3client.send(new GetBucketLocationCommand({ Bucket: context.stateBucketName }));
        expect(response.LocationConstraint).toBe('eu-west-1');
    });

    test('creates encrypted bucket', async () => {
        const response = await context.s3client.send(new GetBucketEncryptionCommand({ Bucket: context.stateBucketName }));
        expect(response.ServerSideEncryptionConfiguration).toBeDefined();
    });

    test('creates bucket with public access block ', async () => {
        const response = await context.s3client.send(new GetPublicAccessBlockCommand({ Bucket: context.stateBucketName }));
        expect(response.PublicAccessBlockConfiguration).toBeDefined();
        expect(response.PublicAccessBlockConfiguration.BlockPublicAcls).toBe(true);
        expect(response.PublicAccessBlockConfiguration.BlockPublicPolicy).toBe(true);
        expect(response.PublicAccessBlockConfiguration.IgnorePublicAcls).toBe(true);
        expect(response.PublicAccessBlockConfiguration.RestrictPublicBuckets).toBe(true);
    });

    test('creates state file within bucket', async () => {
        const response = await context.s3client.send(new GetObjectCommand({ Bucket: context.stateBucketName, Key: 'state.json' }));
        const body = await response.Body.transformToString('utf-8');
        expect(body).toBeDefined();
        const state = JSON.parse(body);
        expect(state.masterAccountId).toBeDefined();
    });

    test('creates template file ', async () => {
        const templateRoot = await TemplateRoot.create(templatePath);
        expect(templateRoot.organizationSection.masterAccount).toBeDefined();
        expect(templateRoot.organizationSection.masterAccount.accountId).toBeDefined();
        expect(templateRoot.organizationSection.masterAccount.rootEmail).toBeDefined();
    });

    afterAll(async () => {
        await baseAfterAll(context);
        unlinkSync(templatePath);
    });
});
