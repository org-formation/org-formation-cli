import { S3, SharedIniFileCredentials } from 'aws-sdk';
import { spawnSync, SpawnSyncReturns } from 'child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'fs';
import * as path from 'path';
import { v4 } from 'uuid';
import {TemplateRoot} from '../../src/parser/parser';

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

        initResponse = spawnSync('ts-node', ['cli.ts', 'init', templateFileName,
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

            updateResponse = spawnSync('ts-node', ['cli.ts', 'update-stacks', templatePath.dir + '/' + 'bucket.yml',
                                                '--stack-name', stackName,
                                                '--profile', awsProfileForTests,
                                                '--state-bucket-name', bucketName]);

            describeStacksResponse = spawnSync('ts-node', ['cli.ts', 'describe-stacks',
                                                '--stack-name', stackName,
                                                '--profile', awsProfileForTests,
                                                '--state-bucket-name', bucketName]);
        });

        afterAll(() => {
            unlinkSync(templatePath.dir + '/' + 'bucket.yml');

            const deleteResponse = spawnSync('ts-node', ['cli.ts', 'delete-stacks',
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


//     describe('when creating nested OU\'s', () => {
//         let updateResponse: SpawnSyncReturns<string>;

//         const templateParentChildPath = templateFileName.replace('.yml', '-parent-child.yml');
//         const parentChild = `
//   ParentOU:
//     Type: OC::ORG::OrganizationalUnit
//     Properties:
//       OrganizationalUnitName: parent
//       OrganizationalUnits: !Ref ChildOU

//   ChildOU:
//     Type: OC::ORG::OrganizationalUnit
//     Properties:
//       OrganizationalUnitName: child`

//         beforeAll(() => {
//             const source = readFileSync(templateFileName).toString('utf-8');
//             writeFileSync(templateParentChildPath, source + parentChild);

//             updateResponse = spawnSync('ts-node', ['cli.ts', 'update', templateParentChildPath,
//                 '--profile', awsProfileForTests,
//                 '--state-bucket-name', bucketName,
//                 '--print-stack']);
//         });

//         afterAll(() => {

//             const cleanupResponse = spawnSync('ts-node', ['cli.ts', 'update', templateFileName,
//                 '--profile', awsProfileForTests,
//                 '--state-bucket-name', bucketName,
//                 '--print-stack']);

//             expect(cleanupResponse).toBeDefined();
//             expect(cleanupResponse.status).toBe(0);
//             expect(cleanupResponse.stderr.toString()).toBe('');

//             unlinkSync(templateParentChildPath);
//         });

//         test('parent OU is added to root ', async () => {
//             expect(updateResponse).toBeDefined();
//             expect(updateResponse.stderr.toString()).toBe('');
//             expect(updateResponse.status).toBe(0);
//             await expectOUInRoot(false, true);
//         });

//         let expectOUInRoot = async (expectChild: boolean, expectParent: boolean) => {

//             const orgService = new Organizations({region: 'us-east-1'});
//             const roots = await orgService.listRoots().promise();
//             const organizationalUnits = await orgService.listOrganizationalUnitsForParent({ ParentId: roots.Roots[0].Id }).promise();
//             const parent = organizationalUnits.OrganizationalUnits.find(x=>x.Name === 'parent');
//             const child = organizationalUnits.OrganizationalUnits.find(x=>x.Name === 'child');

//             if (expectChild) {
//                 expect(child).toBeDefined();
//             } else {
//                 expect(child).toBeUndefined();
//             }

//             if (expectParent) {
//                 expect(parent).toBeDefined();
//             } else {
//                 expect(parent).toBeUndefined();
//             }
//         };

//         describe('when swapping parent and child', () => {

//             const templateChildParentPath = templateFileName.replace('.yml', '-child-parent.yml');
//             const childParent = `
//   ParentOU:
//     Type: OC::ORG::OrganizationalUnit
//     Properties:
//       OrganizationalUnitName: parent

//   ChildOU:
//     Type: OC::ORG::OrganizationalUnit
//     Properties:
//       OrganizationalUnitName: child
//       OrganizationalUnits: !Ref ParentOU`
//             let update2Response: SpawnSyncReturns<string>;

//             beforeAll(() => {
//                 const source = readFileSync(templateFileName).toString('utf-8');
//                 writeFileSync(templateChildParentPath, source + childParent);

//                 update2Response = spawnSync('ts-node', ['cli.ts', 'update', templateChildParentPath,
//                     '--profile', awsProfileForTests,
//                     '--state-bucket-name', bucketName,
//                     '--print-stack']);
//             });

//             afterAll(()=> {
//                 unlinkSync(templateChildParentPath);
//             });

//             test('child OU is now at root ', async () => {
//                 expect(update2Response).toBeDefined();
//                 expect(update2Response.stderr.toString()).toBe('');
//                 expect(updateResponse.status).toBe(0);
//                 await expectOUInRoot(true, false);
//             });

//         });
//     })
});
