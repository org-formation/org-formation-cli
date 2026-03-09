import { DefaultTemplateWriter } from '~writer/default-template-writer';
import { AwsOrganization } from '~aws-provider/aws-organization';
import { AWSPolicy } from '~aws-provider/aws-organization-reader';
import { OrgResourceTypes } from '~parser/model/resource-types';

describe('when generating template with different policy types', () => {
    let writer: DefaultTemplateWriter;
    let mockOrganization: AwsOrganization;

    beforeEach(() => {
        // Create a minimal mock organization
        mockOrganization = {
            masterAccount: {
                Id: '123456789012',
                Name: 'Master',
                Email: 'master@example.com',
                Type: 'Account',
                ParentId: 'r-1234',
                Policies: [],
            },
            roots: [{
                Id: 'r-1234',
                Name: 'Root',
                Arn: 'arn:aws:organizations::123456789012:root/o-1234/r-1234',
                Policies: [],
                OrganizationalUnits: [],
            }],
            organization: {
                Id: 'o-1234',
                Arn: 'arn:aws:organizations::123456789012:organization/o-1234',
                MasterAccountId: '123456789012',
                MasterAccountEmail: 'master@example.com',
            },
            accounts: [],
            organizationalUnits: [],
            policies: [],
            initialize: jest.fn(),
        } as any;

        writer = new DefaultTemplateWriter(mockOrganization);
    });

    test('generates Policy resource for SCP type', async () => {
        const scpPolicy: AWSPolicy = {
            Id: 'p-scp123',
            Name: 'TestSCP',
            Type: 'Policy',
            PolicySummary: {
                Id: 'p-scp123',
                Name: 'TestSCP',
                Type: 'SERVICE_CONTROL_POLICY',
                AwsManaged: false,
                Description: 'Test SCP',
            },
            Content: JSON.stringify({
                Version: '2012-10-17',
                Statement: [],
            }),
            Targets: [],
        };

        mockOrganization.policies = [scpPolicy];

        const template = await writer.generateDefaultTemplate();

        expect(template.template).toContain('Type: OC::ORG::Policy');
        expect(template.template).toContain('PolicyName: TestSCP');
        expect(template.template).toContain('PolicyType: SERVICE_CONTROL_POLICY');
    });

    test('generates Policy resource for RCP type', async () => {
        const rcpPolicy: AWSPolicy = {
            Id: 'p-rcp123',
            Name: 'TestRCP',
            Type: 'Policy',
            PolicySummary: {
                Id: 'p-rcp123',
                Name: 'TestRCP',
                Type: 'RESOURCE_CONTROL_POLICY',
                AwsManaged: false,
                Description: 'Test RCP',
            },
            Content: JSON.stringify({
                Version: '2012-10-17',
                Statement: [],
            }),
            Targets: [],
        };

        mockOrganization.policies = [rcpPolicy];

        const template = await writer.generateDefaultTemplate();

        expect(template.template).toContain('Type: OC::ORG::Policy');
        expect(template.template).toContain('PolicyName: TestRCP');
        expect(template.template).toContain('PolicyType: RESOURCE_CONTROL_POLICY');
    });

    test('generates Policy resource for TAG_POLICY type', async () => {
        const tagPolicy: AWSPolicy = {
            Id: 'p-tag123',
            Name: 'TestTagPolicy',
            Type: 'Policy',
            PolicySummary: {
                Id: 'p-tag123',
                Name: 'TestTagPolicy',
                Type: 'TAG_POLICY',
                AwsManaged: false,
                Description: 'Test Tag Policy',
            },
            Content: JSON.stringify({
                tags: {
                    Environment: {
                        tag_key: {
                            '@@assign': 'Environment',
                        },
                    },
                },
            }),
            Targets: [],
        };

        mockOrganization.policies = [tagPolicy];

        const template = await writer.generateDefaultTemplate();

        expect(template.template).toContain('Type: OC::ORG::Policy');
        expect(template.template).toContain('PolicyName: TestTagPolicy');
        expect(template.template).toContain('PolicyType: TAG_POLICY');
    });

    test('generates Policy resource for BACKUP_POLICY type', async () => {
        const backupPolicy: AWSPolicy = {
            Id: 'p-backup123',
            Name: 'TestBackupPolicy',
            Type: 'Policy',
            PolicySummary: {
                Id: 'p-backup123',
                Name: 'TestBackupPolicy',
                Type: 'BACKUP_POLICY',
                AwsManaged: false,
                Description: 'Test Backup Policy',
            },
            Content: JSON.stringify({
                plans: {},
            }),
            Targets: [],
        };

        mockOrganization.policies = [backupPolicy];

        const template = await writer.generateDefaultTemplate();

        expect(template.template).toContain('Type: OC::ORG::Policy');
        expect(template.template).toContain('PolicyName: TestBackupPolicy');
        expect(template.template).toContain('PolicyType: BACKUP_POLICY');
    });

    test('generates Policy resources for mixed policy types', async () => {
        const scpPolicy: AWSPolicy = {
            Id: 'p-scp123',
            Name: 'TestSCP',
            Type: 'Policy',
            PolicySummary: {
                Id: 'p-scp123',
                Name: 'TestSCP',
                Type: 'SERVICE_CONTROL_POLICY',
                AwsManaged: false,
            },
            Content: JSON.stringify({ Version: '2012-10-17', Statement: [] }),
            Targets: [],
        };

        const rcpPolicy: AWSPolicy = {
            Id: 'p-rcp123',
            Name: 'TestRCP',
            Type: 'Policy',
            PolicySummary: {
                Id: 'p-rcp123',
                Name: 'TestRCP',
                Type: 'RESOURCE_CONTROL_POLICY',
                AwsManaged: false,
            },
            Content: JSON.stringify({ Version: '2012-10-17', Statement: [] }),
            Targets: [],
        };

        mockOrganization.policies = [scpPolicy, rcpPolicy];

        const template = await writer.generateDefaultTemplate();

        // Should have Policy type for both
        expect(template.template).toContain('Type: OC::ORG::Policy');
        expect(template.template).toContain('PolicyType: SERVICE_CONTROL_POLICY');
        expect(template.template).toContain('PolicyType: RESOURCE_CONTROL_POLICY');
    });

    test('skips AWS managed policies', async () => {
        const awsManagedPolicy: AWSPolicy = {
            Id: 'p-aws123',
            Name: 'AWSManagedPolicy',
            Type: 'Policy',
            PolicySummary: {
                Id: 'p-aws123',
                Name: 'AWSManagedPolicy',
                Type: 'SERVICE_CONTROL_POLICY',
                AwsManaged: true,
            },
            Content: JSON.stringify({ Version: '2012-10-17', Statement: [] }),
            Targets: [],
        };

        mockOrganization.policies = [awsManagedPolicy];

        const template = await writer.generateDefaultTemplate();

        expect(template.template).not.toContain('AWSManagedPolicy');
    });

    test('generates Policy resource for AISERVICES_OPT_OUT_POLICY type', async () => {
        const aiPolicy: AWSPolicy = {
            Id: 'p-ai123',
            Name: 'TestAIPolicy',
            Type: 'Policy',
            PolicySummary: {
                Id: 'p-ai123',
                Name: 'TestAIPolicy',
                Type: 'AISERVICES_OPT_OUT_POLICY',
                AwsManaged: false,
            },
            Content: JSON.stringify({
                services: {
                    default: {
                        '@@assign': 'optOut',
                    },
                },
            }),
            Targets: [],
        };

        mockOrganization.policies = [aiPolicy];

        const template = await writer.generateDefaultTemplate();

        expect(template.template).toContain('Type: OC::ORG::Policy');
        expect(template.template).toContain('PolicyName: TestAIPolicy');
        expect(template.template).toContain('PolicyType: AISERVICES_OPT_OUT_POLICY');
    });

    test('generates Policy resource for CHATBOT_POLICY type', async () => {
        const chatbotPolicy: AWSPolicy = {
            Id: 'p-chatbot123',
            Name: 'TestChatbotPolicy',
            Type: 'Policy',
            PolicySummary: {
                Id: 'p-chatbot123',
                Name: 'TestChatbotPolicy',
                Type: 'CHATBOT_POLICY',
                AwsManaged: false,
            },
            Content: JSON.stringify({
                Version: '2012-10-17',
                Statement: [],
            }),
            Targets: [],
        };

        mockOrganization.policies = [chatbotPolicy];

        const template = await writer.generateDefaultTemplate();

        expect(template.template).toContain('Type: OC::ORG::Policy');
        expect(template.template).toContain('PolicyName: TestChatbotPolicy');
        expect(template.template).toContain('PolicyType: CHATBOT_POLICY');
    });
});

describe('when generating logical names for different policy types', () => {
    let writer: DefaultTemplateWriter;
    let mockOrganization: AwsOrganization;

    beforeEach(() => {
        mockOrganization = {
            masterAccount: {
                Id: '123456789012',
                Name: 'Master',
                Email: 'master@example.com',
                Type: 'Account',
                ParentId: 'r-1234',
                Policies: [],
            },
            roots: [{
                Id: 'r-1234',
                Name: 'Root',
                Arn: 'arn:aws:organizations::123456789012:root/o-1234/r-1234',
                Policies: [],
                OrganizationalUnits: [],
            }],
            organization: {
                Id: 'o-1234',
                Arn: 'arn:aws:organizations::123456789012:organization/o-1234',
                MasterAccountId: '123456789012',
                MasterAccountEmail: 'master@example.com',
            },
            accounts: [],
            organizationalUnits: [],
            policies: [],
            initialize: jest.fn(),
        } as any;

        writer = new DefaultTemplateWriter(mockOrganization);
    });

    test('uses SCP suffix for SERVICE_CONTROL_POLICY', async () => {
        const policy: AWSPolicy = {
            Id: 'p-scp123',
            Name: 'Test',
            Type: 'Policy',
            PolicySummary: {
                Id: 'p-scp123',
                Name: 'Test',
                Type: 'SERVICE_CONTROL_POLICY',
                AwsManaged: false,
            },
            Content: JSON.stringify({ Version: '2012-10-17', Statement: [] }),
            Targets: [],
        };

        mockOrganization.policies = [policy];
        const template = await writer.generateDefaultTemplate();

        expect(template.template).toContain('TestSCP:');
    });

    test('uses SHP suffix for SECURITYHUB_POLICY', async () => {
        const policy: AWSPolicy = {
            Id: 'p-shp123',
            Name: 'Test',
            Type: 'Policy',
            PolicySummary: {
                Id: 'p-shp123',
                Name: 'Test',
                Type: 'SECURITYHUB_POLICY',
                AwsManaged: false,
            },
            Content: JSON.stringify({ Version: '2012-10-17', Statement: [] }),
            Targets: [],
        };

        mockOrganization.policies = [policy];
        const template = await writer.generateDefaultTemplate();

        expect(template.template).toContain('TestSHP:');
    });

    test('uses RCP suffix for RESOURCE_CONTROL_POLICY', async () => {
        const policy: AWSPolicy = {
            Id: 'p-rcp123',
            Name: 'Test',
            Type: 'Policy',
            PolicySummary: {
                Id: 'p-rcp123',
                Name: 'Test',
                Type: 'RESOURCE_CONTROL_POLICY',
                AwsManaged: false,
            },
            Content: JSON.stringify({ Version: '2012-10-17', Statement: [] }),
            Targets: [],
        };

        mockOrganization.policies = [policy];
        const template = await writer.generateDefaultTemplate();

        expect(template.template).toContain('TestRCP:');
    });

    test('uses TP suffix for TAG_POLICY', async () => {
        const policy: AWSPolicy = {
            Id: 'p-tp123',
            Name: 'Test',
            Type: 'Policy',
            PolicySummary: {
                Id: 'p-tp123',
                Name: 'Test',
                Type: 'TAG_POLICY',
                AwsManaged: false,
            },
            Content: JSON.stringify({ tags: {} }),
            Targets: [],
        };

        mockOrganization.policies = [policy];
        const template = await writer.generateDefaultTemplate();

        expect(template.template).toContain('TestTP:');
    });

    test('uses BP suffix for BACKUP_POLICY', async () => {
        const policy: AWSPolicy = {
            Id: 'p-bp123',
            Name: 'Test',
            Type: 'Policy',
            PolicySummary: {
                Id: 'p-bp123',
                Name: 'Test',
                Type: 'BACKUP_POLICY',
                AwsManaged: false,
            },
            Content: JSON.stringify({ plans: {} }),
            Targets: [],
        };

        mockOrganization.policies = [policy];
        const template = await writer.generateDefaultTemplate();

        expect(template.template).toContain('TestBP:');
    });

    test('uses IP suffix for INSPECTOR_POLICY', async () => {
        const policy: AWSPolicy = {
            Id: 'p-ip123',
            Name: 'Test',
            Type: 'Policy',
            PolicySummary: {
                Id: 'p-ip123',
                Name: 'Test',
                Type: 'INSPECTOR_POLICY',
                AwsManaged: false,
            },
            Content: JSON.stringify({ Version: '2012-10-17', Statement: [] }),
            Targets: [],
        };

        mockOrganization.policies = [policy];
        const template = await writer.generateDefaultTemplate();

        expect(template.template).toContain('TestIP:');
    });

    test('allows same base name for different policy types with different suffixes', async () => {
        const scpPolicy: AWSPolicy = {
            Id: 'p-scp123',
            Name: 'MyPolicy',
            Type: 'Policy',
            PolicySummary: {
                Id: 'p-scp123',
                Name: 'MyPolicy',
                Type: 'SERVICE_CONTROL_POLICY',
                AwsManaged: false,
            },
            Content: JSON.stringify({ Version: '2012-10-17', Statement: [] }),
            Targets: [],
        };

        const shpPolicy: AWSPolicy = {
            Id: 'p-shp123',
            Name: 'SecurityPolicy',
            Type: 'Policy',
            PolicySummary: {
                Id: 'p-shp123',
                Name: 'SecurityPolicy',
                Type: 'SECURITYHUB_POLICY',
                AwsManaged: false,
            },
            Content: JSON.stringify({ Version: '2012-10-17', Statement: [] }),
            Targets: [],
        };

        mockOrganization.policies = [scpPolicy, shpPolicy];
        const template = await writer.generateDefaultTemplate();

        // Both should exist with different suffixes
        expect(template.template).toContain('MyPolicySCP:');
        expect(template.template).toContain('SecurityPolicySHP:');
    });
});
