
import { OrgResourceTypes } from '~parser/model/resource-types';
import { IPolicyProperties, PolicyResource, PolicyType } from '~parser/model/policy-resource';
import { IResource, TemplateRoot } from '~parser/parser';

describe('when creating policy resource', () => {
    let template: TemplateRoot;
    let resource: IResource;
    let properties: IPolicyProperties;

    beforeEach(async () => {
        template = await TemplateRoot.create('./test/resources/valid-basic.yml');

        properties = {
            PolicyName: 'TestPolicy',
            PolicyType: 'SERVICE_CONTROL_POLICY',
            PolicyDocument: {
                Version: new Date('2012-10-17'),
                Statement: [],
            },
        };
        resource = {
            Type : OrgResourceTypes.Policy,
            Properties: properties,
        };
    });

    test('copies properties from resource', () => {
        const policy = new PolicyResource(template, 'logical-id', resource);
        expect(policy.policyName).toBe(properties.PolicyName);
        expect(policy.policyType).toBe(properties.PolicyType);
        expect(policy.policyDocument).toBe(properties.PolicyDocument);
        expect(policy.description).toBe(properties.Description);
    });

    test('policy version attribute is converted to string', () => {
        const policy = new PolicyResource(template, 'logical-id', resource);
        expect(policy.policyDocument.Version).toBe('2012-10-17');
    });

    test('throws an error if properties are missing', () => {
        resource.Properties = undefined;
        expect(() => { new PolicyResource(template, 'logical-id', resource); }).toThrowError(/logical-id/);
        expect(() => { new PolicyResource(template, 'logical-id', resource); }).toThrowError(/Properties/);
    });

    test('throws an error if policy name is missing', () => {
        delete properties.PolicyName;
        expect(() => { new PolicyResource(template, 'logical-id', resource); }).toThrowError(/logical-id/);
        expect(() => { new PolicyResource(template, 'logical-id', resource); }).toThrowError(/PolicyName/);
    });

    test('throws an error if policy document is missing', () => {
        delete properties.PolicyDocument;
        expect(() => { new PolicyResource(template, 'logical-id', resource); }).toThrowError(/logical-id/);
        expect(() => { new PolicyResource(template, 'logical-id', resource); }).toThrowError(/PolicyDocument/);
    });

    test('throws an error if policy type is missing', () => {
        delete properties.PolicyType;
        expect(() => { new PolicyResource(template, 'logical-id', resource); }).toThrowError(/logical-id/);
        expect(() => { new PolicyResource(template, 'logical-id', resource); }).toThrowError(/PolicyType/);
    });

    test('accepts description as optional property', () => {
        properties.Description = 'Test policy description';
        const policy = new PolicyResource(template, 'logical-id', resource);
        expect(policy.description).toBe('Test policy description');
    });

    test('hash is stable for SERVICE_CONTROL_POLICY', () => {
        const instance = new PolicyResource(template, 'logical-id', resource);
        const hash = instance.calculateHash();
        expect(hash).toBeDefined();
        expect(hash.length).toBe(32); // MD5 hash length
    });
});

describe('when creating policy resource with different policy types', () => {
    let template: TemplateRoot;
    let resource: IResource;
    let properties: IPolicyProperties;

    beforeEach(async () => {
        template = await TemplateRoot.create('./test/resources/valid-basic.yml');
    });

    test('accepts RESOURCE_CONTROL_POLICY type', () => {
        properties = {
            PolicyName: 'TestRCP',
            PolicyType: 'RESOURCE_CONTROL_POLICY',
            PolicyDocument: {
                Version: '2012-10-17',
                Statement: [{
                    Effect: 'Deny',
                    Principal: '*',
                    Action: 's3:*',
                    Resource: '*',
                }],
            },
        };
        resource = {
            Type: OrgResourceTypes.Policy,
            Properties: properties,
        };

        const policy = new PolicyResource(template, 'rcp-id', resource);
        expect(policy.policyType).toBe('RESOURCE_CONTROL_POLICY');
        expect(policy.policyName).toBe('TestRCP');
    });

    test('accepts TAG_POLICY type', () => {
        properties = {
            PolicyName: 'TestTagPolicy',
            PolicyType: 'TAG_POLICY',
            PolicyDocument: {
                tags: {
                    Environment: {
                        tag_key: {
                            '@@assign': 'Environment',
                        },
                    },
                },
            },
        };
        resource = {
            Type: OrgResourceTypes.Policy,
            Properties: properties,
        };

        const policy = new PolicyResource(template, 'tag-policy-id', resource);
        expect(policy.policyType).toBe('TAG_POLICY');
        expect(policy.policyDocument.tags).toBeDefined();
    });

    test('accepts BACKUP_POLICY type', () => {
        properties = {
            PolicyName: 'TestBackupPolicy',
            PolicyType: 'BACKUP_POLICY',
            PolicyDocument: {
                plans: {
                    DailyBackup: {
                        regions: {
                            '@@assign': ['us-east-1'],
                        },
                    },
                },
            },
        };
        resource = {
            Type: OrgResourceTypes.Policy,
            Properties: properties,
        };

        const policy = new PolicyResource(template, 'backup-policy-id', resource);
        expect(policy.policyType).toBe('BACKUP_POLICY');
        expect(policy.policyDocument.plans).toBeDefined();
    });

    test('accepts AISERVICES_OPT_OUT_POLICY type', () => {
        properties = {
            PolicyName: 'TestAIOptOut',
            PolicyType: 'AISERVICES_OPT_OUT_POLICY',
            PolicyDocument: {
                services: {
                    default: {
                        '@@assign': 'optOut',
                    },
                },
            },
        };
        resource = {
            Type: OrgResourceTypes.Policy,
            Properties: properties,
        };

        const policy = new PolicyResource(template, 'ai-policy-id', resource);
        expect(policy.policyType).toBe('AISERVICES_OPT_OUT_POLICY');
    });

    test('accepts CHATBOT_POLICY type', () => {
        properties = {
            PolicyName: 'TestChatbotPolicy',
            PolicyType: 'CHATBOT_POLICY',
            PolicyDocument: {
                Version: '2012-10-17',
                Statement: [],
            },
        };
        resource = {
            Type: OrgResourceTypes.Policy,
            Properties: properties,
        };

        const policy = new PolicyResource(template, 'chatbot-policy-id', resource);
        expect(policy.policyType).toBe('CHATBOT_POLICY');
    });

    test('accepts DECLARATIVE_POLICY_EC2 type', () => {
        properties = {
            PolicyName: 'TestDeclarativePolicy',
            PolicyType: 'DECLARATIVE_POLICY_EC2',
            PolicyDocument: {
                Version: '2012-10-17',
                Statement: [],
            },
        };
        resource = {
            Type: OrgResourceTypes.Policy,
            Properties: properties,
        };

        const policy = new PolicyResource(template, 'declarative-policy-id', resource);
        expect(policy.policyType).toBe('DECLARATIVE_POLICY_EC2');
    });

    test('accepts SECURITYHUB_POLICY type', () => {
        properties = {
            PolicyName: 'TestSecurityHubPolicy',
            PolicyType: 'SECURITYHUB_POLICY',
            PolicyDocument: {
                Version: '2012-10-17',
                Statement: [],
            },
        };
        resource = {
            Type: OrgResourceTypes.Policy,
            Properties: properties,
        };

        const policy = new PolicyResource(template, 'securityhub-policy-id', resource);
        expect(policy.policyType).toBe('SECURITYHUB_POLICY');
    });

    test('accepts INSPECTOR_POLICY type', () => {
        properties = {
            PolicyName: 'TestInspectorPolicy',
            PolicyType: 'INSPECTOR_POLICY',
            PolicyDocument: {
                Version: '2012-10-17',
                Statement: [],
            },
        };
        resource = {
            Type: OrgResourceTypes.Policy,
            Properties: properties,
        };

        const policy = new PolicyResource(template, 'inspector-policy-id', resource);
        expect(policy.policyType).toBe('INSPECTOR_POLICY');
    });

    test('accepts UPGRADE_ROLLOUT_POLICY type', () => {
        properties = {
            PolicyName: 'TestUpgradePolicy',
            PolicyType: 'UPGRADE_ROLLOUT_POLICY',
            PolicyDocument: {
                Version: '2012-10-17',
                Statement: [],
            },
        };
        resource = {
            Type: OrgResourceTypes.Policy,
            Properties: properties,
        };

        const policy = new PolicyResource(template, 'upgrade-policy-id', resource);
        expect(policy.policyType).toBe('UPGRADE_ROLLOUT_POLICY');
    });

    test('accepts BEDROCK_POLICY type', () => {
        properties = {
            PolicyName: 'TestBedrockPolicy',
            PolicyType: 'BEDROCK_POLICY',
            PolicyDocument: {
                Version: '2012-10-17',
                Statement: [],
            },
        };
        resource = {
            Type: OrgResourceTypes.Policy,
            Properties: properties,
        };

        const policy = new PolicyResource(template, 'bedrock-policy-id', resource);
        expect(policy.policyType).toBe('BEDROCK_POLICY');
    });

    test('accepts S3_POLICY type', () => {
        properties = {
            PolicyName: 'TestS3Policy',
            PolicyType: 'S3_POLICY',
            PolicyDocument: {
                Version: '2012-10-17',
                Statement: [],
            },
        };
        resource = {
            Type: OrgResourceTypes.Policy,
            Properties: properties,
        };

        const policy = new PolicyResource(template, 's3-policy-id', resource);
        expect(policy.policyType).toBe('S3_POLICY');
    });

    test('accepts NETWORK_SECURITY_DIRECTOR_POLICY type', () => {
        properties = {
            PolicyName: 'TestNetworkSecurityPolicy',
            PolicyType: 'NETWORK_SECURITY_DIRECTOR_POLICY',
            PolicyDocument: {
                Version: '2012-10-17',
                Statement: [],
            },
        };
        resource = {
            Type: OrgResourceTypes.Policy,
            Properties: properties,
        };

        const policy = new PolicyResource(template, 'network-policy-id', resource);
        expect(policy.policyType).toBe('NETWORK_SECURITY_DIRECTOR_POLICY');
    });
});

describe('when creating policy resource with complex policy documents', () => {
    let template: TemplateRoot;

    beforeEach(async () => {
        template = await TemplateRoot.create('./test/resources/valid-basic.yml');
    });

    test('handles complex RCP document', () => {
        const properties: IPolicyProperties = {
            PolicyName: 'ComplexRCP',
            PolicyType: 'RESOURCE_CONTROL_POLICY',
            Description: 'Complex resource control policy',
            PolicyDocument: {
                Version: '2012-10-17',
                Statement: [
                    {
                        Sid: 'DenyPublicS3',
                        Effect: 'Deny',
                        Principal: '*',
                        Action: [
                            's3:PutBucketPublicAccessBlock',
                            's3:PutAccountPublicAccessBlock',
                        ],
                        Resource: '*',
                        Condition: {
                            StringNotEquals: {
                                's3:ResourceAccount': '${aws:PrincipalAccount}',
                            },
                        },
                    },
                ],
            },
        };

        const resource: IResource = {
            Type: OrgResourceTypes.Policy,
            Properties: properties,
        };

        const policy = new PolicyResource(template, 'complex-rcp', resource);
        expect(policy.policyDocument.Statement).toHaveLength(1);
        expect(policy.policyDocument.Statement[0].Sid).toBe('DenyPublicS3');
        expect(policy.policyDocument.Statement[0].Action).toHaveLength(2);
    });

    test('handles complex Tag Policy document', () => {
        const properties: IPolicyProperties = {
            PolicyName: 'ComplexTagPolicy',
            PolicyType: 'TAG_POLICY',
            Description: 'Complex tag policy with multiple tags',
            PolicyDocument: {
                tags: {
                    Environment: {
                        tag_key: {
                            '@@assign': 'Environment',
                        },
                        tag_value: {
                            '@@assign': ['Production', 'Development', 'Staging'],
                        },
                        enforced_for: {
                            '@@assign': ['s3:bucket', 'ec2:instance', 'rds:db'],
                        },
                    },
                    CostCenter: {
                        tag_key: {
                            '@@assign': 'CostCenter',
                        },
                        tag_value: {
                            '@@assign': ['Engineering', 'Marketing', 'Sales'],
                        },
                    },
                },
            },
        };

        const resource: IResource = {
            Type: OrgResourceTypes.Policy,
            Properties: properties,
        };

        const policy = new PolicyResource(template, 'complex-tag', resource);
        expect(policy.policyDocument.tags.Environment).toBeDefined();
        expect(policy.policyDocument.tags.CostCenter).toBeDefined();
        expect(policy.policyDocument.tags.Environment.tag_value['@@assign']).toHaveLength(3);
    });

    test('handles complex Backup Policy document', () => {
        const properties: IPolicyProperties = {
            PolicyName: 'ComplexBackupPolicy',
            PolicyType: 'BACKUP_POLICY',
            Description: 'Complex backup policy with multiple plans',
            PolicyDocument: {
                plans: {
                    DailyBackupPlan: {
                        regions: {
                            '@@assign': ['us-east-1', 'eu-west-1'],
                        },
                        rules: {
                            DailyBackupRule: {
                                schedule_expression: {
                                    '@@assign': 'cron(0 5 ? * * *)',
                                },
                                start_backup_window_minutes: {
                                    '@@assign': '60',
                                },
                                complete_backup_window_minutes: {
                                    '@@assign': '120',
                                },
                                lifecycle: {
                                    delete_after_days: {
                                        '@@assign': '30',
                                    },
                                    move_to_cold_storage_after_days: {
                                        '@@assign': '7',
                                    },
                                },
                            },
                        },
                        selections: {
                            tags: {
                                BackupDaily: {
                                    iam_role_arn: {
                                        '@@assign': 'arn:aws:iam::$account:role/BackupRole',
                                    },
                                    tag_key: {
                                        '@@assign': 'Backup',
                                    },
                                    tag_value: {
                                        '@@assign': ['Daily'],
                                    },
                                },
                            },
                        },
                    },
                },
            },
        };

        const resource: IResource = {
            Type: OrgResourceTypes.Policy,
            Properties: properties,
        };

        const policy = new PolicyResource(template, 'complex-backup', resource);
        expect(policy.policyDocument.plans.DailyBackupPlan).toBeDefined();
        expect(policy.policyDocument.plans.DailyBackupPlan.rules.DailyBackupRule).toBeDefined();
        expect(policy.policyDocument.plans.DailyBackupPlan.selections.tags.BackupDaily).toBeDefined();
    });
});
