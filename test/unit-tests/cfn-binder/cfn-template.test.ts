import * as chai from 'chai';
import { expect } from 'chai';
import { CfnTemplate } from '../../../src/cfn-binder/cfn-template';
import { CloudFormationResource } from '../../../src/parser/model/cloudformation-resource';
import { IResourceTarget } from '../../../src/parser/model/resources-section';
import { TemplateRoot } from '../../../src/parser/parser';
import { PersistedState } from '../../../src/state/persisted-state';
import { TestTemplates } from '../test-templates'

chai.use(require('chai-as-promised'));

describe('when creating cloudformation with simple resource', () => {
    let template: CfnTemplate;
    let templateRoot: TemplateRoot;
    let persistedState: PersistedState;
    let target: IResourceTarget;
    let templateForTarget: string;

    beforeEach(async () => {
        templateRoot = TestTemplates.createBasicTemplate();
        persistedState = PersistedState.CreateEmpty(templateRoot.organizationSection.masterAccount.accountId);

        target = {
            region: 'eu-central-1',
            accountLogicalId: templateRoot.organizationSection.accounts[0].logicalId,
            resources: [
                new CloudFormationResource(templateRoot, 'bucket',
                    {
                        Type: 'AWS::S3::Bucket',
                        Properties: {
                            BucketName: 'BucketName'
                        },
                        OrganizationBindings: {
                            Accounts: '*',
                        },
                    }),
            ],
        };

        template = new CfnTemplate(target, templateRoot, persistedState);
        templateForTarget = template.createTemplateBody();
    });

    it('returns template body', () => {
        expect(templateForTarget).to.not.be.undefined;
    });

    it('template contains resource', () => {
        const result = JSON.parse(templateForTarget);
        expect(result).to.not.be.undefined;
        expect(result.Resources).to.not.be.undefined;
        expect(result.Resources.bucket).to.not.be.undefined;
        expect(result.Resources.bucket.Type).to.eq('AWS::S3::Bucket');
        expect(result.Resources.bucket.Properties).to.not.be.undefined;
        expect(result.Resources.bucket.Properties.BucketName).to.eq('BucketName');
    });

    it('template contains version', () => {
        const result = JSON.parse(templateForTarget);
        expect(result.AWSTemplateFormatVersion).to.eq('2010-09-09');
    });

    it('template resource doesnt contain organization binding', () => {
        const result = JSON.parse(templateForTarget);
        expect(result).to.not.be.undefined;
        expect(result.Resources).to.not.be.undefined;
        expect(result.Resources.bucket).to.not.be.undefined;
        expect(result.Resources.bucket.OrganizationBindings).to.be.undefined;
    });

});

describe('when creating cloudformation with resource that has version attribute', () => {
    let template: CfnTemplate;
    let templateRoot: TemplateRoot;
    let persistedState: PersistedState;
    let target: IResourceTarget;
    let templateForTarget: string;

    beforeEach(async () => {
        templateRoot = TestTemplates.createBasicTemplate();
        persistedState = PersistedState.CreateEmpty(templateRoot.organizationSection.masterAccount.accountId);

        target = {
            region: 'eu-central-1',
            accountLogicalId: templateRoot.organizationSection.accounts[0].logicalId,
            resources: [
                new CloudFormationResource(templateRoot, 'BucketPolicy',
                    {
                        Type: 'AWS::S3::BucketPolicy',
                        Properties: {
                            Bucket: 'Bucket',
                            PolicyDocument: {
                              Version: '2012-10-17T00:00:00.000Z'
                            }
                        },
                        OrganizationBindings: {
                            Accounts: '*',
                        },
                    }),
            ],
        };

        template = new CfnTemplate(target, templateRoot, persistedState);
        templateForTarget = template.createTemplateBody();
    });

    it('resource contains version in cfn format', () => {
        const result = JSON.parse(templateForTarget);
        expect(result.Resources.BucketPolicy).to.not.be.undefined;
        expect(result.Resources.BucketPolicy.Properties.PolicyDocument.Version).to.not.be.undefined;
        expect(result.Resources.BucketPolicy.Properties.PolicyDocument.Version).to.eq('2012-10-17');
    });
});