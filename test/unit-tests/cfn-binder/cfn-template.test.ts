import * as chai from 'chai';
import { expect } from 'chai';
import { CfnTemplate } from '../../../src/cfn-binder/cfn-template';
import { CloudFormationResource } from '../../../src/parser/model/cloudformation-resource';
import { IResourceTarget, ResourcesSection } from '../../../src/parser/model/resources-section';
import { TemplateRoot } from '../../../src/parser/parser';
import { PersistedState } from '../../../src/state/persisted-state';
import { TestTemplates } from '../test-templates';

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
                            BucketName: 'BucketName',
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
                              Version: '2012-10-17T00:00:00.000Z',
                            },
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

describe('when creating cloudformation with output section', () => {
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
                            BucketName: 'BucketName',
                        },
                        OrganizationBindings: {
                            Accounts: '*',
                        },
                    }),
            ],
        };

        templateRoot.resourcesSection.resources.push(target.resources[0]);
        templateRoot.resourcesSection.resources.push(new CloudFormationResource(templateRoot, 'bucket2', {Type: 'abcdef'}, templateRoot.contents.OrganizationBindings));

        templateRoot.contents.Outputs = {
            Output : {
                Value: {Ref: 'bucket'},
            },
            OutputRefOtherTarget: {
                Value: {Ref: 'bucket2'},
            },
            OutputGetAttOtherTarget: {
                Value: {'Fn::GetAtt': ['bucket2', 'bucketName']},
            },
            OutputGetOrgFunctions: {
                Value:  {'Fn::GetAtt': ['AWSAccount', 'AccountName']},
            },
        };
        template = new CfnTemplate(target, templateRoot, persistedState);
        templateForTarget = template.createTemplateBody();
    });

    it('template contains output in same target', () => {
        const result = JSON.parse(templateForTarget);
        expect(result).to.not.be.undefined;
        expect(result.Outputs).to.not.be.undefined;
        expect(result.Outputs.Output.Value.Ref).to.eq('bucket');
    });

    it('output to Ref in other target is removed', () => {
        const result = JSON.parse(templateForTarget);
        expect(result).to.not.be.undefined;
        expect(result.Outputs).to.not.be.undefined;
        expect(result.Outputs.OutputRefOtherTarget).to.be.undefined;
    });

    it('output to GetAtt in other target is removed', () => {
        const result = JSON.parse(templateForTarget);
        expect(result).to.not.be.undefined;
        expect(result.Outputs).to.not.be.undefined;
        expect(result.Outputs.OutputGetAttOtherTarget).to.be.undefined;
    });

    it('output to Org function is resolved', () => {
        const result = JSON.parse(templateForTarget);
        expect(result).to.not.be.undefined;
        expect(result.Outputs).to.not.be.undefined;
        expect(result.Outputs.OutputGetOrgFunctions).to.not.be.undefined;
        expect(result.Outputs.OutputGetOrgFunctions.Value).to.eq('My Account 1');
    });
});

describe('when creating cross account reference', () => {
    let template: CfnTemplate;
    let templateRoot: TemplateRoot;
    let persistedState: PersistedState;
    let target: IResourceTarget;
    let templateForTarget: string;

    beforeEach(async () => {
        templateRoot = TestTemplates.createBasicTemplate();
        persistedState = PersistedState.CreateEmpty(templateRoot.organizationSection.masterAccount.accountId);

        const account1 = templateRoot.organizationSection.accounts[0].logicalId;
        const account2 = templateRoot.organizationSection.accounts[1].logicalId;

        target = {
            region: 'eu-central-1',
            accountLogicalId: account1,
            resources: [
                new CloudFormationResource(templateRoot, 'bucket',
                    {
                        Type: 'AWS::S3::Bucket',
                        Properties: {
                            BucketName: { Ref : 'bucket2' },
                        },
                        OrganizationBindings: {
                            Accounts: { Ref: account1 },
                        },
                    }),
            ],
        };

        const other = new CloudFormationResource(templateRoot, 'bucket2',
            {
                Type: 'abcdef',
                OrganizationBindings: {
                    Accounts: {
                        Ref: account2,
                    },
                },
            });

        templateRoot.resourcesSection.resources.push(target.resources[0]);
        templateRoot.resourcesSection.resources.push(other);

        template = new CfnTemplate(target, templateRoot, persistedState);
        templateForTarget = template.createTemplateBody();
    });

    it('parameter was added to template', () => {
        const result = JSON.parse(templateForTarget);
        expect(result).to.not.be.undefined;
        expect(result.Parameters).to.not.be.undefined;
    });

});
