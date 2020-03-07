import { S3, SharedIniFileCredentials, Organizations } from 'aws-sdk';
import { spawnSync, SpawnSyncReturns } from 'child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'fs';
import * as path from 'path';
import { v4 } from 'uuid';
import { TemplateRoot } from '../../src/parser/parser';

const awsProfileForTests = 'org-formation-test';
jest.setTimeout(9999999);


describe('when manipulating ous', () => {
    const creds = new SharedIniFileCredentials({profile: awsProfileForTests});;
    const orgService = new Organizations({region: 'us-east-1', credentials: creds});
    const s3client = new S3({credentials: creds});
    let bucketName: string;
    let templatePath: path.ParsedPath;
    let templateFileName: string;
    let updateResponse: SpawnSyncReturns<string>;
    let templateRoot: TemplateRoot;

    let templateParentChildPath: string;
    const parentChild = `
  ParentOU:
    Type: OC::ORG::OrganizationalUnit
    Properties:
      OrganizationalUnitName: parent
      OrganizationalUnits: !Ref ChildOU

  ChildOU:
    Type: OC::ORG::OrganizationalUnit
    Properties:
      OrganizationalUnitName: child`

    beforeEach(async (done) => {
        bucketName = `${v4()}`;
        templatePath = path.parse(`./test/integration-tests/temp/${v4()}.yml`);
        templateFileName = templatePath.dir + '/' + templatePath.base;
        templateParentChildPath = templateFileName.replace('.yml', '-parent-child.yml');

        const roots = await orgService.listRoots().promise();
        const organizationalUnits = await orgService.listOrganizationalUnitsForParent({ ParentId: roots.Roots[0].Id }).promise();
        const parent = organizationalUnits.OrganizationalUnits.find(x=>x.Name === 'parent');
        const child = organizationalUnits.OrganizationalUnits.find(x=>x.Name === 'child');

        if (parent !== undefined) {
            await deleteOU(parent);
        }
        if (child !== undefined) {
            await deleteOU(child);
        }

        console.info(`executing init:`)
        const init = spawnProcess('init', 'npx', ['ts-node', 'cli.ts', 'init', templateFileName,
                                            '--profile', awsProfileForTests,
                                            '--state-bucket-name', bucketName,
                                            '--region', 'eu-west-1',
                                            '--verbose',
                                            '--print-stack']);

        templateRoot = TemplateRoot.create(templateFileName);
        const source = readFileSync(templateFileName).toString('utf-8');
        writeFileSync(templateParentChildPath, source + parentChild);

        updateResponse = spawnProcess('update', 'npx', ['ts-node', 'cli.ts', 'update', templateParentChildPath,
            '--profile', awsProfileForTests,
            '--state-bucket-name', bucketName,
            '--verbose',
            '--print-stack']);

        done();
    });
    afterEach(async (done) => {

        spawnProcess('cleanup', 'npx', ['ts-node', 'cli.ts', 'update', templateFileName,
            '--profile', awsProfileForTests,
            '--state-bucket-name', bucketName,
            '--verbose',
            '--print-stack']);

        const response = await s3client.listObjects({Bucket: bucketName}).promise();
        const objectIdentifiers = response.Contents.map((x) => ({Key: x.Key}));
        await s3client.deleteObjects({Bucket: bucketName, Delete: { Objects: objectIdentifiers}}).promise();
        await s3client.deleteBucket({Bucket: bucketName}).promise();
        unlinkSync(templateFileName);
        unlinkSync(templateParentChildPath);

        done();
    });
    test('adding parent and child succeeded', async () => {
        expect(updateResponse).toBeDefined();
        expect(updateResponse.stderr.toString()).toBe('');
        expect(updateResponse.status).toBe(0);
        await expectOUInRoot(false, true);
    })

    test('can swap parent with child ', async () => {
        const templateChildParentPath = templateFileName.replace('.yml', '-child-parent.yml');
        const childParent = `
  ParentOU:
    Type: OC::ORG::OrganizationalUnit
    Properties:
      OrganizationalUnitName: parent

  ChildOU:
    Type: OC::ORG::OrganizationalUnit
    Properties:
      OrganizationalUnitName: child
      OrganizationalUnits: !Ref ParentOU`
        let update2Response: SpawnSyncReturns<string>;
        const source = readFileSync(templateFileName).toString('utf-8');

        writeFileSync(templateChildParentPath, source + childParent);

        update2Response = spawnProcess('swap parent with child', 'npx', ['ts-node', 'cli.ts', 'update', templateChildParentPath,
            '--profile', awsProfileForTests,
            '--state-bucket-name', bucketName,
            '--verbose',
            '--print-stack']);

        await expectOUInRoot(true, false);


        unlinkSync(templateChildParentPath);
    });

    test('can delete parent and keep child', async () => {
        const templateWithoutParentPath = templateFileName.replace('.yml', '-without-parent.yml');
        const withoutParent = `
  ChildOU:
    Type: OC::ORG::OrganizationalUnit
    Properties:
      OrganizationalUnitName: child`
        const source = readFileSync(templateFileName).toString('utf-8');

        writeFileSync(templateWithoutParentPath, source + withoutParent);

        spawnProcess('delete parent, keep child', 'npx', ['ts-node', 'cli.ts', 'update', templateWithoutParentPath,
            '--profile', awsProfileForTests,
            '--state-bucket-name', bucketName,
            '--verbose',
            '--print-stack']);

        await expectOUInRoot(true, false);

        unlinkSync(templateWithoutParentPath);
    });

    test('can delete parent and keep child with accounts ', async () => {

        const source = readFileSync(templateFileName).toString('utf-8');

        const templateWithAccountsInOUsFileName = templateFileName.replace('.yml', '-with-accounts.yml');

        const withAccounts = `
  ParentOU:
    Type: OC::ORG::OrganizationalUnit
    Properties:
      OrganizationalUnitName: parent
      OrganizationalUnits: !Ref ChildOU
      Accounts: !Ref ${templateRoot.organizationSection.accounts[0].logicalId}

  ChildOU:
    Type: OC::ORG::OrganizationalUnit
    Properties:
      OrganizationalUnitName: child
      Accounts: !Ref ${templateRoot.organizationSection.accounts[1].logicalId}`;

        let sourceRewritten = source.replace(/\s*- !Ref ${templateRoot.organizationSection.accounts[0].logicalId}/, '');
        sourceRewritten = sourceRewritten.replace(/\s*- !Ref ${templateRoot.organizationSection.accounts[1].logicalId}/, '');

        writeFileSync(templateWithAccountsInOUsFileName, sourceRewritten + withAccounts);

        spawnProcess('delete parent, keep child', 'npx', ['ts-node', 'cli.ts', 'update', templateWithAccountsInOUsFileName,
            '--profile', awsProfileForTests,
            '--state-bucket-name', bucketName,
            '--verbose',
            '--print-stack']);

        const templateWithoutParentPath = templateFileName.replace('.yml', '-without-parent.yml');
        const withoutParent = `
  ChildOU:
    Type: OC::ORG::OrganizationalUnit
    Properties:
      OrganizationalUnitName: child`

        writeFileSync(templateWithoutParentPath, source + withoutParent);

        spawnProcess('delete parent, keep child','npx', ['ts-node', 'cli.ts', 'update', templateWithoutParentPath,
            '--profile', awsProfileForTests,
            '--state-bucket-name', bucketName,
            '--verbose',
            '--print-stack']);

        await expectOUInRoot(true, false);

        unlinkSync(templateWithAccountsInOUsFileName);
        unlinkSync(templateWithoutParentPath);
    });

    test('can delete child and keep parent ', async () => {
        const templateWithoutChildPath = templateFileName.replace('.yml', '-without-child.yml');
        const withoutParent = `
  ParentOU:
    Type: OC::ORG::OrganizationalUnit
    Properties:
      OrganizationalUnitName: parent`
        let update2Response: SpawnSyncReturns<string>;
        const source = readFileSync(templateFileName).toString('utf-8');

        writeFileSync(templateWithoutChildPath, source + withoutParent);

        update2Response = spawnProcess('delete child, keep parent','npx', ['ts-node', 'cli.ts', 'update', templateWithoutChildPath,
            '--profile', awsProfileForTests,
            '--state-bucket-name', bucketName,
            '--verbose',
            '--print-stack']);

        expect(update2Response).toBeDefined();
        expect(update2Response.stderr.toString()).toBe('');
        expect(updateResponse.status).toBe(0);
        await expectOUInRoot(false, true);

        unlinkSync(templateWithoutChildPath);
    });

    let deleteOU = async(ou: Organizations.OrganizationalUnit) => {
        const organizationalUnits = await orgService.listOrganizationalUnitsForParent({ ParentId: ou.Id }).promise();
        for(const child of organizationalUnits.OrganizationalUnits) {
            await deleteOU(child);
        }

        await orgService.deleteOrganizationalUnit({OrganizationalUnitId: ou.Id}).promise();
    };

    let expectOUInRoot = async (expectChild: boolean, expectParent: boolean) => {
        const roots = await orgService.listRoots().promise();
        const organizationalUnits = await orgService.listOrganizationalUnitsForParent({ ParentId: roots.Roots[0].Id }).promise();
        const parent = organizationalUnits.OrganizationalUnits.find(x=>x.Name === 'parent');
        const child = organizationalUnits.OrganizationalUnits.find(x=>x.Name === 'child');

        if (expectChild) {
            expect(child).toBeDefined();
        } else {
            expect(child).toBeUndefined();
        }

        if (expectParent) {
            expect(parent).toBeDefined();
        } else {
            expect(parent).toBeUndefined();
        }
    };
    let spawnProcess = (logicalName: string, command: string, args: readonly string[]) => {
        console.info(`executing ${logicalName}: ${command} ${args.join(' ')}`)
        const response = spawnSync(command, args);
        console.info(`${logicalName} output: \n` + response.stdout.toString());
        const stderr = response.stderr.toString();
        if (stderr !== '') {
            console.error(`${logicalName} error: \n` + response.stderr.toString());
        }

        expect(response).toBeDefined();
        expect(stderr).toBe('');
        expect(response.status).toBe(0);
        return response;
    };
});