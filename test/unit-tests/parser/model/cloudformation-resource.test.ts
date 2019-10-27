import { expect } from 'chai';
import { CloudFormationResource } from '../../../../src/parser/model/cloudformation-resource';
import { IOrganizationBindings, IResource, IResourceRef, IResourceRefExpression, TemplateRoot } from '../../../../src/parser/parser';
import { TestTemplates } from '../../test-templates';

describe('when creating cloudformation resource with * accounts', () => {
    let template: TemplateRoot;
    let resource: IResource;
    let account: CloudFormationResource;

    beforeEach(() => {
        template = TestTemplates.createBasicTemplate();

        resource = {
            Type : 'AWS::S3::Bucket',
            OrganizationBindings: {
                Accounts: '*',
                Regions: 'eu-central-1',
            },
            Properties: {
                BucketName: 'test-bucket',
            },
        };
        account = new CloudFormationResource(template, 'logical-id', resource);
        account.resolveRefs();
    });

    it('copies properties from resource', () => {
        const orgBindings = (account as any).bindings as IOrganizationBindings;
        expect(orgBindings.Accounts).to.eq('*');
        expect(orgBindings.Regions).to.eq('eu-central-1');
    });

    it('normalized accounts contains all accounts', () => {
        const normalizedAccounts = account.getNormalizedBoundAccounts();
        const allAccounts = template.organizationSection.accounts.map((x) => x.logicalId);
        expect(normalizedAccounts.sort().join(',')).to.eq(allAccounts.sort().join(','));
    });

    it('normalized accounts contains does not contain master account', () => {
        const normalizedAccounts = account.getNormalizedBoundAccounts();
        const masterAccount = template.organizationSection.masterAccount.logicalId;
        const containsMaster = normalizedAccounts.indexOf(masterAccount) !== -1;
        expect(containsMaster).to.eq(false);
    });
});

describe('when creating cloudformation resource with include master', () => {
    let template: TemplateRoot;
    let resource: IResource;
    let account: CloudFormationResource;

    beforeEach(() => {
        template = TestTemplates.createBasicTemplate();

        resource = {
            Type : 'AWS::S3::Bucket',
            OrganizationBindings: {
                IncludeMasterAccount: true,
                Regions: 'eu-central-1',
            },
            Properties: {
                BucketName: 'test-bucket',
            },
        };
        account = new CloudFormationResource(template, 'logical-id', resource);
        account.resolveRefs();
    });

    it('copies properties from resource', () => {
        const orgBindings = (account as any).bindings as IOrganizationBindings;
        expect(orgBindings.IncludeMasterAccount).to.eq(true);
        expect(orgBindings.Regions).to.eq('eu-central-1');
    });

    it('normalized accounts returns master account', () => {
        const normalizedAccounts = account.getNormalizedBoundAccounts();
        const masterAccountId = template.organizationSection.masterAccount.logicalId;
        expect(normalizedAccounts[0]).to.eq(masterAccountId);
        expect(normalizedAccounts.length).to.eq(1);
    });
});

describe('when including specific account as value', () => {
    let template: TemplateRoot;
    let resource: IResource;
    let account: CloudFormationResource;

    beforeEach(() => {
        template = TestTemplates.createBasicTemplate();

        resource = {
            Type : 'AWS::S3::Bucket',
            OrganizationBindings: {
                Accounts: {Ref: 'Account2'},
                Regions: 'eu-central-1',
            },
            Properties: {
                BucketName: 'test-bucket',
            },
        };
        account = new CloudFormationResource(template, 'logical-id', resource);
        account.resolveRefs();
    });

    it('copies properties from resource', () => {
        const orgBindings = (account as any).bindings as IOrganizationBindings;
        expect(Array.isArray(orgBindings.Accounts)).to.eq(false);
        expect((orgBindings.Accounts as IResourceRefExpression).Ref).to.eq('Account2');
        expect(orgBindings.Regions).to.eq('eu-central-1');
    });

    it('normalized accounts returns specific account', () => {
        const normalizedAccounts = account.getNormalizedBoundAccounts();
        expect(normalizedAccounts[0]).to.eq('Account2');
        expect(normalizedAccounts.length).to.eq(1);
    });
});

describe('when including specific account as array', () => {
    let template: TemplateRoot;
    let resource: IResource;
    let account: CloudFormationResource;

    beforeEach(() => {
        template = TestTemplates.createBasicTemplate();

        resource = {
            Type : 'AWS::S3::Bucket',
            OrganizationBindings: {
                Accounts: [{Ref: 'Account2'}],
                Regions: 'eu-central-1',
            },
            Properties: {
                BucketName: 'test-bucket',
            },
        };
        account = new CloudFormationResource(template, 'logical-id', resource);
        account.resolveRefs();
    });

    it('copies properties from resource', () => {
        const orgBindings = (account as any).bindings as IOrganizationBindings;
        expect(Array.isArray(orgBindings.Accounts)).to.eq(true);
        expect(orgBindings.Accounts[0].Ref).to.eq('Account2');
        expect(orgBindings.Regions).to.eq('eu-central-1');
    });

    it('normalized accounts returns specific account', () => {
        const normalizedAccounts = account.getNormalizedBoundAccounts();
        expect(normalizedAccounts[0]).to.eq('Account2');
        expect(normalizedAccounts.length).to.eq(1);
    });
});

describe('when including specific account that doesnt exist', () => {
    let template: TemplateRoot;
    let resource: IResource;
    let account: CloudFormationResource;

    beforeEach(() => {
        template = TestTemplates.createBasicTemplate();

        resource = {
            Type : 'AWS::S3::Bucket',
            OrganizationBindings: {
                Accounts: {Ref: 'AccountX'},
                Regions: 'eu-central-1',
            },
            Properties: {
                BucketName: 'test-bucket',
            },
        };
        account = new CloudFormationResource(template, 'logical-id', resource);
    });

    it('resolving references throws', () => {
        try {
            account.resolveRefs();
            expect.fail('expected exception to have been thrown');
        } catch (err) {
            expect(err.message).to.contain('AccountX');
        }
    });
});

describe('when exluding specific account as value', () => {
    let template: TemplateRoot;
    let resource: IResource;
    let account: CloudFormationResource;

    beforeEach(() => {
        template = TestTemplates.createBasicTemplate();

        resource = {
            Type : 'AWS::S3::Bucket',
            OrganizationBindings: {
                Accounts: '*',
                ExcludeAccounts: {Ref: 'Account2'},
                Regions: 'eu-central-1',
            },
            Properties: {
                BucketName: 'test-bucket',
            },
        };
        account = new CloudFormationResource(template, 'logical-id', resource);
        account.resolveRefs();
    });

    it('copies properties from resource', () => {
        const orgBindings = (account as any).bindings as IOrganizationBindings;
        expect(orgBindings.Accounts).to.eq('*');
        expect((orgBindings.ExcludeAccounts as IResourceRefExpression).Ref).to.eq('Account2');
        expect(orgBindings.Regions).to.eq('eu-central-1');
    });

    it('normalized does not return exluded account', () => {
        const normalizedAccounts = account.getNormalizedBoundAccounts();
        expect(normalizedAccounts[0]).to.eq('Account');
        expect(normalizedAccounts.length).to.eq(1);
    });
});

describe('when exluding specific account that doesnt exist', () => {
    let template: TemplateRoot;
    let resource: IResource;
    let account: CloudFormationResource;

    beforeEach(() => {
        template = TestTemplates.createBasicTemplate();

        resource = {
            Type : 'AWS::S3::Bucket',
            OrganizationBindings: {
                Accounts: '*',
                ExcludeAccounts: {Ref: 'XYZ'},
                Regions: 'eu-central-1',
            },
            Properties: {
                BucketName: 'test-bucket',
            },
        };
        account = new CloudFormationResource(template, 'logical-id', resource);

    });

    it('resolving references throws', () => {
        try {
            account.resolveRefs();
            expect.fail('expected exception to have been thrown');
        } catch (err) {
            expect(err.message).to.contain('XYZ');
        }
    });
});

describe('when excluding specific account as array', () => {
    let template: TemplateRoot;
    let resource: IResource;
    let account: CloudFormationResource;

    beforeEach(() => {
        template = TestTemplates.createBasicTemplate();

        resource = {
            Type : 'AWS::S3::Bucket',
            OrganizationBindings: {
                Accounts: '*',
                ExcludeAccounts: [{Ref: 'Account2'}],
                Regions: 'eu-central-1',
            },
            Properties: {
                BucketName: 'test-bucket',
            },
        };
        account = new CloudFormationResource(template, 'logical-id', resource);
        account.resolveRefs();
    });

    it('copies properties from resource', () => {
        const orgBindings = (account as any).bindings as IOrganizationBindings;
        expect(Array.isArray(orgBindings.ExcludeAccounts)).to.eq(true);
        expect(orgBindings.ExcludeAccounts[0].Ref).to.eq('Account2');
        expect(orgBindings.Accounts).to.eq('*');
        expect(orgBindings.Regions).to.eq('eu-central-1');
    });

    it('normalized accounts does not return exluded account', () => {
        const normalizedAccounts = account.getNormalizedBoundAccounts();
        expect(normalizedAccounts[0]).to.eq('Account');
        expect(normalizedAccounts.length).to.eq(1);
    });
});

describe('when including specific ou as value', () => {
    let template: TemplateRoot;
    let resource: IResource;
    let account: CloudFormationResource;

    beforeEach(() => {
        template = TestTemplates.createBasicTemplate();

        resource = {
            Type : 'AWS::S3::Bucket',
            OrganizationBindings: {
                OrganizationalUnits: {Ref: 'OU'},
                Regions: 'eu-central-1',
            },
            Properties: {
                BucketName: 'test-bucket',
            },
        };
        account = new CloudFormationResource(template, 'logical-id', resource);
        account.resolveRefs();
    });

    it('copies properties from resource', () => {
        const orgBindings = (account as any).bindings as IOrganizationBindings;
        expect(Array.isArray(orgBindings.OrganizationalUnits)).to.eq(false);
        expect((orgBindings.OrganizationalUnits as IResourceRefExpression).Ref).to.eq('OU');
        expect(orgBindings.Regions).to.eq('eu-central-1');
    });

    it('normalized accounts returns accounts from ou', () => {
        const normalizedAccounts = account.getNormalizedBoundAccounts();
        expect(normalizedAccounts[0]).to.eq('Account');
        expect(normalizedAccounts.length).to.eq(1);
    });
});

describe('when including specific ou that doesnt exist', () => {
    let template: TemplateRoot;
    let resource: IResource;
    let account: CloudFormationResource;

    beforeEach(() => {
        template = TestTemplates.createBasicTemplate();

        resource = {
            Type : 'AWS::S3::Bucket',
            OrganizationBindings: {
                OrganizationalUnits: [{Ref: 'XXX'}],
                Regions: 'eu-central-1',
            },
            Properties: {
                BucketName: 'test-bucket',
            },
        };
        account = new CloudFormationResource(template, 'logical-id', resource);
    });

    it('resolving references throws', () => {
        try {
            account.resolveRefs();
            expect.fail('expected exception to have been thrown');
        } catch (err) {
            expect(err.message).to.contain('XXX');
        }
    });
});

describe('when including specific account as array', () => {
    let template: TemplateRoot;
    let resource: IResource;
    let account: CloudFormationResource;

    beforeEach(() => {
        template = TestTemplates.createBasicTemplate();

        resource = {
            Type : 'AWS::S3::Bucket',
            OrganizationBindings: {
                OrganizationalUnits: [{Ref: 'OU'}],
                Regions: 'eu-central-1',
            },
            Properties: {
                BucketName: 'test-bucket',
            },
        };
        account = new CloudFormationResource(template, 'logical-id', resource);
        account.resolveRefs();
    });

    it('copies properties from resource', () => {
        const orgBindings = (account as any).bindings as IOrganizationBindings;
        expect(Array.isArray(orgBindings.OrganizationalUnits)).to.eq(true);
        expect(orgBindings.OrganizationalUnits[0].Ref).to.eq('OU');
        expect(orgBindings.Regions).to.eq('eu-central-1');
    });

    it('normalized accounts returns accounts from ou', () => {
        const normalizedAccounts = account.getNormalizedBoundAccounts();
        expect(normalizedAccounts[0]).to.eq('Account');
        expect(normalizedAccounts.length).to.eq(1);
    });
});
