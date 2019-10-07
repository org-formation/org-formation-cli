import { S3, SharedIniFileCredentials, STS } from 'aws-sdk';
import { expect } from 'chai';
import { spawnSync, SpawnSyncReturns } from 'child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'fs';
import * as path from 'path';
import { v4 } from 'uuid';
import {TemplateRoot} from '../../src/parser/parser';

describe('when calling org-formation init', () => {
    const creds = new SharedIniFileCredentials({profile: 'org-formation-test'});
    const s3client = new S3({credentials: creds});
    const bucketName = `${v4()}`;
    const templatePath = path.parse(`./test/integration-tests/temp/${v4()}.yml`);
    const templateFileName = templatePath.dir + '/' + templatePath.base;
    let initResponse: SpawnSyncReturns<string>;
    let template: TemplateRoot;

    before(async () => {

        initResponse = spawnSync('ts-node', ['cli.ts', 'init', templateFileName,
                                            '--profile', 'org-formation-test',
                                            '--state-bucket-name', bucketName,
                                            '--state-bucket-region', 'eu-west-1']);

        template = TemplateRoot.create(templateFileName);
    });

    after(async () => {
        const response = await s3client.listObjects({Bucket: bucketName}).promise();
        const objectIdentifiers = response.Contents.map((x) => ({Key: x.Key}));
        await s3client.deleteObjects({Bucket: bucketName, Delete: { Objects: objectIdentifiers}}).promise();
        await s3client.deleteBucket({Bucket: bucketName}).promise();
        unlinkSync(templateFileName);
    });

    it('does not return error', () => {
        expect(initResponse).to.not.be.undefined;
        expect(initResponse.status).to.eq(0);
        expect(initResponse.stderr.toString()).eq('');
    });

    it('creates bucket in the right region', async () => {
        const response = await s3client.getBucketLocation({Bucket: bucketName}).promise();
        expect(response.LocationConstraint).eq('eu-west-1');
    });

    it('creates encrypted bucket', async () => {
        const response = await s3client.getBucketEncryption({Bucket: bucketName}).promise();
        expect(response.ServerSideEncryptionConfiguration).is.not.undefined;
    });

    it('creates bucket with public access block ', async () => {
        const response = await s3client.getPublicAccessBlock({Bucket: bucketName}).promise();
        expect(response.PublicAccessBlockConfiguration).is.not.undefined;
        expect(response.PublicAccessBlockConfiguration.BlockPublicAcls).to.eq(true);
        expect(response.PublicAccessBlockConfiguration.BlockPublicPolicy).to.eq(true);
        expect(response.PublicAccessBlockConfiguration.IgnorePublicAcls).to.eq(true);
        expect(response.PublicAccessBlockConfiguration.RestrictPublicBuckets).to.eq(true);
    });

    describe('when calling update account resources', () => {
        const stackName = 'a' + v4().replace(/-/g, '');
        let updateResponse: SpawnSyncReturns<string>;
        let describeStacksResponse: SpawnSyncReturns<string>;

        before(() => {
            const templateResourcesFile = readFileSync('./test/integration-tests/resources/org-formation-bucket.yml').toString('utf8');

            const contents = templateResourcesFile.replace('./organization.yml', './' + templatePath.base);
            writeFileSync(templatePath.dir + '/' + 'bucket.yml', contents);

            updateResponse = spawnSync('ts-node', ['cli.ts', 'update-accounts', templatePath.dir + '/' + 'bucket.yml',
                                                '--stack-name', stackName,
                                                '--profile', 'org-formation-test',
                                                '--state-bucket-name', bucketName]);

            describeStacksResponse = spawnSync('ts-node', ['cli.ts', 'describe-stacks',
                                                '--stack-name', stackName,
                                                '--profile', 'org-formation-test',
                                                '--state-bucket-name', bucketName]);
        });

        after(() => {
            unlinkSync(templatePath.dir + '/' + 'bucket.yml');

            const deleteResponse = spawnSync('ts-node', ['cli.ts', 'delete-stacks', stackName,
                                                '--profile', 'org-formation-test',
                                                '--state-bucket-name', bucketName]);

            expect(deleteResponse).to.not.be.undefined;
            expect(deleteResponse.status).to.eq(0);
            expect(deleteResponse.stderr.toString()).eq('');
        });

        it('update does not return error', () => {
            expect(updateResponse).to.not.be.undefined;
            expect(updateResponse.status).to.eq(0);
            expect(updateResponse.stderr.toString()).eq('');
        });

        it('describe-stacks does not return error', () => {
            expect(describeStacksResponse).to.not.be.undefined;
            expect(describeStacksResponse.status).to.eq(0);
            expect(describeStacksResponse.stderr.toString()).eq('');
        });
    });
});
