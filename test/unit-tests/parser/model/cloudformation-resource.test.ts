import { CloudFormationResource } from '../../../../src/parser/model/cloudformation-resource';
import { IOrganizationBinding, IResource, IResourceRef, IResourceRefExpression, TemplateRoot } from '../../../../src/parser/parser';
import { TestTemplates } from '../../test-templates';

describe('when creating cloudformation resource with * accounts', () => {
    let template: TemplateRoot;
    let resource: IResource;
    let account: CloudFormationResource;

    beforeEach(() => {
        template = TestTemplates.createBasicTemplate();

        resource = {
            Type : 'AWS::S3::Bucket',
            OrganizationBinding: {
                Account: '*',
                Region: 'eu-central-1',
            },
            Properties: {
                BucketName: 'test-bucket',
            },
        };
        account = new CloudFormationResource(template, 'logical-id', resource);

        account.resolveRefs();
    });

    test('copies properties from resource', () => {
        const orgBindings = (account as any).binding as IOrganizationBinding;
        expect(orgBindings.Account).toBe('*');
        expect(orgBindings.Region).toBe('eu-central-1');
    });

    test('normalized accounts contains all accounts', () => {
        const normalizedAccounts = account.normalizedBoundAccounts;
        const allAccounts = template.organizationSection.accounts.map((x) => x.logicalId);
        expect(normalizedAccounts.sort().join(',')).toBe(allAccounts.sort().join(','));
    });

    test('normalized accounts contains does not contain master account', () => {
        const normalizedAccounts = account.normalizedBoundAccounts;
        const masterAccount = template.organizationSection.masterAccount.logicalId;
        const containsMaster = normalizedAccounts.indexOf(masterAccount) !== -1;
        expect(containsMaster).toBe(false);
    });

    test('resource for tempalte does not contain organizational bindings', () => {
        expect(account.resourceForTemplate.OrganizationBinding).toBeUndefined();
        expect(account.resourceForTemplate.Type).toBeDefined();
        expect(account.resourceForTemplate.Properties).toBeDefined();
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
            OrganizationBinding: {
                IncludeMasterAccount: true,
                Region: 'eu-central-1',
            },
            Properties: {
                BucketName: 'test-bucket',
            },
        };
        account = new CloudFormationResource(template, 'logical-id', resource);
        account.resolveRefs();
    });

    test('copies properties from resource', () => {
        const orgBindings = (account as any).binding as IOrganizationBinding;
        expect(orgBindings.IncludeMasterAccount).toBe(true);
        expect(orgBindings.Region).toBe('eu-central-1');
    });

    test('normalized accounts returns master account', () => {
        const normalizedAccounts =  account.normalizedBoundAccounts;
        const masterAccountId = template.organizationSection.masterAccount.logicalId;
        expect(normalizedAccounts[0]).toBe(masterAccountId);
        expect(normalizedAccounts.length).toBe(1);
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
            OrganizationBinding: {
                Account: {Ref: 'Account2'},
                Region: 'eu-central-1',
            },
            Properties: {
                BucketName: 'test-bucket',
            },
        };
        account = new CloudFormationResource(template, 'logical-id', resource);
        account.resolveRefs();
    });

    test('copies properties from resource', () => {
        const orgBindings = (account as any).binding as IOrganizationBinding;
        expect(Array.isArray(orgBindings.Account)).toBe(false);
        expect((orgBindings.Account as IResourceRefExpression).Ref).toBe('Account2');
        expect(orgBindings.Region).toBe('eu-central-1');
    });

    test('normalized accounts returns specific account', () => {
        const normalizedAccounts = account.normalizedBoundAccounts;
        expect(normalizedAccounts[0]).toBe('Account2');
        expect(normalizedAccounts.length).toBe(1);
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
            OrganizationBinding: {
                Account: [{Ref: 'Account2'}],
                Region: 'eu-central-1',
            },
            Properties: {
                BucketName: 'test-bucket',
            },
        };
        account = new CloudFormationResource(template, 'logical-id', resource);
        account.resolveRefs();
    });

    test('copies properties from resource', () => {
        const orgBindings = (account as any).binding as IOrganizationBinding;
        expect(Array.isArray(orgBindings.Account)).toBe(true);
        expect((orgBindings.Account as any)[0].Ref).toBe('Account2');
        expect(orgBindings.Region).toBe('eu-central-1');
    });

    test('normalized accounts returns specific account', () => {
        const normalizedAccounts = account.normalizedBoundAccounts;
        expect(normalizedAccounts[0]).toBe('Account2');
        expect(normalizedAccounts.length).toBe(1);
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
            OrganizationBinding: {
                Account: {Ref: 'AccountX'},
                Region: 'eu-central-1',
            },
            Properties: {
                BucketName: 'test-bucket',
            },
        };
        account = new CloudFormationResource(template, 'logical-id', resource);
    });

    test('resolving references throws', () => {
        try {
            account.resolveRefs();
            throw new Error('expected exception to have been thrown');
        } catch (err) {
            expect(err.message).toEqual(expect.stringContaining('AccountX'));
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
            OrganizationBinding: {
                Account: '*',
                ExcludeAccount: {Ref: 'Account2'},
                Region: 'eu-central-1',
            },
            Properties: {
                BucketName: 'test-bucket',
            },
        };
        account = new CloudFormationResource(template, 'logical-id', resource);
        account.resolveRefs();
    });

    test('copies properties from resource', () => {
        const orgBindings = (account as any).binding as IOrganizationBinding;
        expect(orgBindings.Account).toBe('*');
        expect((orgBindings.ExcludeAccount as IResourceRefExpression).Ref).toBe('Account2');
        expect(orgBindings.Region).toBe('eu-central-1');
    });

    test('normalized does not return exluded account', () => {
        const normalizedAccounts = account.normalizedBoundAccounts;
        expect(normalizedAccounts[0]).toBe('Account');
        expect(normalizedAccounts.length).toBe(1);
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
            OrganizationBinding: {
                Account: '*',
                ExcludeAccount: {Ref: 'XYZ'},
                Region: 'eu-central-1',
            },
            Properties: {
                BucketName: 'test-bucket',
            },
        };
        account = new CloudFormationResource(template, 'logical-id', resource);

    });

    test('resolving references throws', () => {
        try {
            account.resolveRefs();
            throw new Error('expected exception to have been thrown');
        } catch (err) {
            expect(err.message).toEqual(expect.stringContaining('XYZ'));
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
            OrganizationBinding: {
                Account: '*',
                ExcludeAccount: [{Ref: 'Account2'}],
                Region: 'eu-central-1',
            },
            Properties: {
                BucketName: 'test-bucket',
            },
        };
        account = new CloudFormationResource(template, 'logical-id', resource);
        account.resolveRefs();
    });

    test('copies properties from resource', () => {
        const orgBindings = (account as any).binding as IOrganizationBinding;
        expect(Array.isArray(orgBindings.ExcludeAccount)).toBe(true);
        expect((orgBindings.ExcludeAccount as any)[0].Ref).toBe('Account2');
        expect(orgBindings.Account).toBe('*');
        expect(orgBindings.Region).toBe('eu-central-1');
    });

    test('normalized accounts does not return exluded account', () => {
        const normalizedAccounts = account.normalizedBoundAccounts;
        expect(normalizedAccounts[0]).toBe('Account');
        expect(normalizedAccounts.length).toBe(1);
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
            OrganizationBinding: {
                OrganizationalUnit: {Ref: 'OU'},
                Region: 'eu-central-1',
            },
            Properties: {
                BucketName: 'test-bucket',
            },
        };
        account = new CloudFormationResource(template, 'logical-id', resource);
        account.resolveRefs();
    });

    test('copies properties from resource', () => {
        const orgBindings = (account as any).binding as IOrganizationBinding;
        expect(Array.isArray(orgBindings.OrganizationalUnit)).toBe(false);
        expect((orgBindings.OrganizationalUnit as IResourceRefExpression).Ref).toBe('OU');
        expect(orgBindings.Region).toBe('eu-central-1');
    });

    test('normalized accounts returns accounts from ou', () => {
        const normalizedAccounts = account.normalizedBoundAccounts;
        expect(normalizedAccounts[0]).toBe('Account');
        expect(normalizedAccounts.length).toBe(1);
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
            OrganizationBinding: {
                OrganizationalUnit: [{Ref: 'XXX'}],
                Region: 'eu-central-1',
            },
            Properties: {
                BucketName: 'test-bucket',
            },
        };
        account = new CloudFormationResource(template, 'logical-id', resource);
    });

    test('resolving references throws', () => {
        try {
            account.resolveRefs();
            throw new Error('expected exception to have been thrown');
        } catch (err) {
            expect(err.message).toEqual(expect.stringContaining('XXX'));
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
            OrganizationBinding: {
                OrganizationalUnit: [{Ref: 'OU'}],
                Region: 'eu-central-1',
            },
            Properties: {
                BucketName: 'test-bucket',
            },
        };
        account = new CloudFormationResource(template, 'logical-id', resource);
        account.resolveRefs();
    });

    test('copies properties from resource', () => {
        const orgBindings = (account as any).binding as IOrganizationBinding;
        expect(Array.isArray(orgBindings.OrganizationalUnit)).toBe(true);
        expect((orgBindings.OrganizationalUnit as any)[0].Ref).toBe('OU');
        expect(orgBindings.Region).toBe('eu-central-1');
    });

    test('normalized accounts returns accounts from ou', () => {
        const normalizedAccounts = account.normalizedBoundAccounts;
        expect(normalizedAccounts[0]).toBe('Account');
        expect(normalizedAccounts.length).toBe(1);
    });
});

describe('when declaring foreach on element level', () => {
    let template: TemplateRoot;
    let resource: IResource;
    let account: CloudFormationResource;

    beforeEach(() => {
        template = TestTemplates.createBasicTemplate();

        resource = {
            Type : 'AWS::S3::Bucket',
            OrganizationBinding: {
                IncludeMasterAccount: true,
                Region: 'eu-central-1',
            },
            ForeachAccount: {
                OrganizationalUnit: [{Ref: 'OU'}],
                Region: 'eu-central-1'
            },
            Properties: {
                BucketName: 'test-bucket',
            },
        };
        account = new CloudFormationResource(template, 'logical-id', resource);
        account.resolveRefs();
    });

    test('copies properties from resource', () => {
        const foreachBinding = (account as any).foreachAccount as IOrganizationBinding;
        expect(Array.isArray(foreachBinding.OrganizationalUnit)).toBe(true);
        expect((foreachBinding.OrganizationalUnit as any)[0].Ref).toBe('OU');
    });

    test('Foreach attribute is removed from resource for template', () => {
        expect(account.resourceForTemplate.Foreach).toBeUndefined();
        expect(account.resourceForTemplate.Type).toBeDefined();
        expect(account.resourceForTemplate.Properties).toBeDefined();
    });
});

describe('when adding attribute that is not supported to organizational bindings', () => {
    let template: TemplateRoot;
    let resource: IResource;
    beforeEach(() => {
        template = TestTemplates.createBasicTemplate();

        resource = {
            Type : 'AWS::S3::Bucket',
            OrganizationBinding: {
                Something: [{Ref: 'XXX'}],
                Region: 'eu-central-1',
            },
            Properties: {
                BucketName: 'test-bucket',
            },
        };
    });

    test('resolving references throws', () => {
        try {
            new CloudFormationResource(template, 'logical-id', resource);
        } catch (err) {
            expect(err.message).toEqual(expect.stringContaining('Something'));
            expect(err.message).toEqual(expect.stringContaining('logical-id'));
            expect(err.message).toEqual(expect.stringContaining('OrganizationBinding'));
        }
    });
});

describe('when adding attribute that is not supported to foreach', () => {
    let template: TemplateRoot;
    let resource: IResource;
    beforeEach(() => {
        template = TestTemplates.createBasicTemplate();

        resource = {
            Type : 'AWS::S3::Bucket',
            ForeachAccount: {
                Something: [{Ref: 'XXX'}],
            },
            OrganizationBinding: {
                Region: 'eu-central-1',
            },
            Properties: {
                BucketName: 'test-bucket',
            },
        };
    });

    test('resolving references throws', () => {
        try {
            new CloudFormationResource(template, 'logical-id', resource);
        } catch (err) {
            expect(err.message).toEqual(expect.stringContaining('Something'));
            expect(err.message).toEqual(expect.stringContaining('logical-id'));
            expect(err.message).toEqual(expect.stringContaining('Foreach'));
        }
    });
});

describe('when adding region which is not supported to foreach', () => {
    let template: TemplateRoot;
    let resource: IResource;
    beforeEach(() => {
        template = TestTemplates.createBasicTemplate();

        resource = {
            Type : 'AWS::S3::Bucket',
            ForeachAccount: {
                Region: 'eu-central-1',
            },
            Properties: {
                BucketName: 'test-bucket',
            },
            OrganizationBinding: {
                Region: 'eu-central-1'
            },
        };
    });

    test('resolving references throws', () => {
        try {
            new CloudFormationResource(template, 'logical-id', resource);
        } catch (err) {
            expect(err.message).toEqual(expect.stringContaining('Region'));
            expect(err.message).toEqual(expect.stringContaining('logical-id'));
            expect(err.message).toEqual(expect.stringContaining('Foreach'));
        }
    });
});
