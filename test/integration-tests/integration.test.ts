import { S3, SharedIniFileCredentials } from 'aws-sdk';
import { spawnSync, SpawnSyncReturns } from 'child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'fs';
import * as path from 'path';
import { v4 } from 'uuid';
import {TemplateRoot} from '~parser/parser';

const awsProfileForTests = 'org-formation-test';

describe('when calling org-formation init', () => {
    const creds = new SharedIniFileCredentials({profile: 'org-formation-test'});
    const s3client = new S3({credentials: creds});
    const bucketName = `${v4()}`;
    const templatePath = path.parse(`./test/integration-tests/temp/${v4()}.yml`);
    const templateFileName = templatePath.dir + '/' + templatePath.base;
    let initResponse: SpawnSyncReturns<string>;
    let template: TemplateRoot;

    beforeAll(async () => {

        initResponse = spawnSync('npx', ['ts-node', 'cli.ts', 'init', templateFileName,
                                            '--profile', awsProfileForTests,
                                            '--state-bucket-name', bucketName,
                                            '--region', 'eu-west-1',
                                            '--print-stack']);

        template = TemplateRoot.create(templateFileName);
    });

    afterAll(async () => {
        const response = await s3client.listObjects({Bucket: bucketName}).promise();
        const objectIdentifiers = response.Contents.map((x) => ({Key: x.Key}));
        await s3client.deleteObjects({Bucket: bucketName, Delete: { Objects: objectIdentifiers}}).promise();
        await s3client.deleteBucket({Bucket: bucketName}).promise();
        unlinkSync(templateFileName);
    });

    test('does not return error', () => {
        if (initResponse.stderr) {
            const error = initResponse.stderr.toString();
            if (error && error !== '') {
                console.error(error);
            }
        }
        expect(initResponse).toBeDefined();
        expect(initResponse.status).toBe(0);
        expect(initResponse.stderr.toString()).toBe('');
    });

    test('creates bucket in the right region', async () => {
        const response = await s3client.getBucketLocation({Bucket: bucketName}).promise();
        expect(response.LocationConstraint).toBe('eu-west-1');
    });

    test('creates encrypted bucket', async () => {
        const response = await s3client.getBucketEncryption({Bucket: bucketName}).promise();
        expect(response.ServerSideEncryptionConfiguration).toBeDefined();
    });

    test('creates bucket with public access block ', async () => {
        const response = await s3client.getPublicAccessBlock({Bucket: bucketName}).promise();
        expect(response.PublicAccessBlockConfiguration).toBeDefined();
        expect(response.PublicAccessBlockConfiguration.BlockPublicAcls).toBe(true);
        expect(response.PublicAccessBlockConfiguration.BlockPublicPolicy).toBe(true);
        expect(response.PublicAccessBlockConfiguration.IgnorePublicAcls).toBe(true);
        expect(response.PublicAccessBlockConfiguration.RestrictPublicBuckets).toBe(true);
    });

    test('creates state file within bucket ', async () => {
        const response = await s3client.getObject({Bucket: bucketName, Key: 'state.json'}).promise();
        expect(response.Body).toBeDefined();
        const state = JSON.parse(response.Body.toString());
        expect(state.masterAccountId).toBeDefined();
    });

    describe('when calling update account resources', () => {
        const stackName = 'a' + v4().replace(/-/g, '');
        let updateResponse: SpawnSyncReturns<string>;
        let describeStacksResponse: SpawnSyncReturns<string>;

        beforeAll(() => {
            const templateResourcesFile = readFileSync('./test/integration-tests/resources/org-formation-bucket.yml').toString('utf8');

            const contents = templateResourcesFile.replace('./organization.yml', './' + templatePath.base);
            writeFileSync(templatePath.dir + '/' + 'bucket.yml', contents);

            updateResponse = spawnSync('npx', [ 'ts-node', 'cli.ts', 'update-stacks', templatePath.dir + '/' + 'bucket.yml',
                                                '--stack-name', stackName,
                                                '--profile', awsProfileForTests,
                                                '--state-bucket-name', bucketName]);

            describeStacksResponse = spawnSync('npx', ['ts-node', 'cli.ts', 'describe-stacks',
                                                '--stack-name', stackName,
                                                '--profile', awsProfileForTests,
                                                '--state-bucket-name', bucketName]);
        });

        afterAll(() => {
            unlinkSync(templatePath.dir + '/' + 'bucket.yml');

            const deleteResponse = spawnSync('npx', ['ts-node', 'cli.ts', 'delete-stacks',
                                                '--stack-name', stackName,
                                                '--profile', awsProfileForTests,
                                                '--state-bucket-name', bucketName]);

            expect(deleteResponse).toBeDefined();
            expect(deleteResponse.status).toBe(0);
            expect(deleteResponse.stderr.toString()).toBe('');
        });

        test('update does not return error', () => {
            expect(updateResponse).toBeDefined();
            expect(updateResponse.status).toBe(0);
            expect(updateResponse.stderr.toString()).toBe('');
        });

        test('describe-stacks does not return error', () => {
            expect(describeStacksResponse).toBeDefined();
            expect(describeStacksResponse.status).toBe(0);
            expect(describeStacksResponse.stderr.toString()).toBe('');
        });
    });
});
