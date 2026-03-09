
import { OrgResourceTypes } from '~parser/model/resource-types';
import { TemplateRoot } from '~parser/parser';

describe('when parsing organization section with Policy resources', () => {
    test('can parse template with Policy resource', async () => {
        const template = TemplateRoot.createFromContents(`
Organization:
  MasterAccount:
    Type: OC::ORG::MasterAccount
    Properties:
      AccountName: Master Account
      AccountId: '123456789012'
      RootEmail: master@example.com

  OrganizationRoot:
    Type: OC::ORG::OrganizationRoot
    Properties:
      ServiceControlPolicies: !Ref TestPolicy

  TestPolicy:
    Type: OC::ORG::Policy
    Properties:
      PolicyName: TestPolicy
      PolicyType: SERVICE_CONTROL_POLICY
      Description: Test policy
      PolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Deny
            Action: '*'
            Resource: '*'
`, './');

        expect(template.organizationSection.policies).toBeDefined();
        expect(template.organizationSection.policies.length).toBe(1);
        expect(template.organizationSection.policies[0].policyName).toBe('TestPolicy');
        expect(template.organizationSection.policies[0].policyType).toBe('SERVICE_CONTROL_POLICY');
    });

    test('can parse template with multiple Policy resources of different types', async () => {
        const template = TemplateRoot.createFromContents(`
Organization:
  MasterAccount:
    Type: OC::ORG::MasterAccount
    Properties:
      AccountName: Master Account
      AccountId: '123456789012'
      RootEmail: master@example.com

  OrganizationRoot:
    Type: OC::ORG::OrganizationRoot
    Properties:
      ServiceControlPolicies:
        - !Ref SCPPolicy
        - !Ref RCPPolicy

  SCPPolicy:
    Type: OC::ORG::Policy
    Properties:
      PolicyName: ServiceControlPolicy
      PolicyType: SERVICE_CONTROL_POLICY
      PolicyDocument:
        Version: '2012-10-17'
        Statement: []

  RCPPolicy:
    Type: OC::ORG::Policy
    Properties:
      PolicyName: ResourceControlPolicy
      PolicyType: RESOURCE_CONTROL_POLICY
      PolicyDocument:
        Version: '2012-10-17'
        Statement: []

  TagPolicy:
    Type: OC::ORG::Policy
    Properties:
      PolicyName: TagPolicy
      PolicyType: TAG_POLICY
      PolicyDocument:
        tags:
          Environment:
            tag_key:
              '@@assign': Environment
`, './');

        expect(template.organizationSection.policies.length).toBe(3);
        
        const scpPolicy = template.organizationSection.policies.find(p => p.policyName === 'ServiceControlPolicy');
        expect(scpPolicy).toBeDefined();
        expect(scpPolicy!.policyType).toBe('SERVICE_CONTROL_POLICY');

        const rcpPolicy = template.organizationSection.policies.find(p => p.policyName === 'ResourceControlPolicy');
        expect(rcpPolicy).toBeDefined();
        expect(rcpPolicy!.policyType).toBe('RESOURCE_CONTROL_POLICY');

        const tagPolicy = template.organizationSection.policies.find(p => p.policyName === 'TagPolicy');
        expect(tagPolicy).toBeDefined();
        expect(tagPolicy!.policyType).toBe('TAG_POLICY');
    });

    test('can parse template with both ServiceControlPolicy and Policy resources', async () => {
        const template = TemplateRoot.createFromContents(`
Organization:
  MasterAccount:
    Type: OC::ORG::MasterAccount
    Properties:
      AccountName: Master Account
      AccountId: '123456789012'
      RootEmail: master@example.com

  OrganizationRoot:
    Type: OC::ORG::OrganizationRoot
    Properties:
      ServiceControlPolicies:
        - !Ref LegacySCP
        - !Ref NewPolicy

  LegacySCP:
    Type: OC::ORG::ServiceControlPolicy
    Properties:
      PolicyName: LegacyPolicy
      PolicyDocument:
        Version: '2012-10-17'
        Statement: []

  NewPolicy:
    Type: OC::ORG::Policy
    Properties:
      PolicyName: NewPolicy
      PolicyType: RESOURCE_CONTROL_POLICY
      PolicyDocument:
        Version: '2012-10-17'
        Statement: []
`, './');

        expect(template.organizationSection.serviceControlPolicies.length).toBe(1);
        expect(template.organizationSection.policies.length).toBe(1);
        
        expect(template.organizationSection.serviceControlPolicies[0].policyName).toBe('LegacyPolicy');
        expect(template.organizationSection.policies[0].policyName).toBe('NewPolicy');
        expect(template.organizationSection.policies[0].policyType).toBe('RESOURCE_CONTROL_POLICY');
    });

    test('throws error for duplicate policy names across Policy resources', () => {
        expect(() => {
            TemplateRoot.createFromContents(`
Organization:
  MasterAccount:
    Type: OC::ORG::MasterAccount
    Properties:
      AccountName: Master Account
      AccountId: '123456789012'
      RootEmail: master@example.com

  Policy1:
    Type: OC::ORG::Policy
    Properties:
      PolicyName: DuplicateName
      PolicyType: SERVICE_CONTROL_POLICY
      PolicyDocument:
        Version: '2012-10-17'
        Statement: []

  Policy2:
    Type: OC::ORG::Policy
    Properties:
      PolicyName: DuplicateName
      PolicyType: TAG_POLICY
      PolicyDocument:
        tags: {}
`, './');
        }).toThrowError(/DuplicateName/);
    });

    test('can attach Policy to Account', async () => {
        const template = TemplateRoot.createFromContents(`
Organization:
  MasterAccount:
    Type: OC::ORG::MasterAccount
    Properties:
      AccountName: Master Account
      AccountId: '123456789012'
      RootEmail: master@example.com

  TestAccount:
    Type: OC::ORG::Account
    Properties:
      AccountName: Test Account
      AccountId: '123456789013'
      RootEmail: test@example.com
      ServiceControlPolicies: !Ref TestPolicy

  TestPolicy:
    Type: OC::ORG::Policy
    Properties:
      PolicyName: TestPolicy
      PolicyType: RESOURCE_CONTROL_POLICY
      PolicyDocument:
        Version: '2012-10-17'
        Statement: []
`, './');

        const account = template.organizationSection.accounts[0];
        expect(account.serviceControlPolicies).toBeDefined();
        expect(account.serviceControlPolicies!.length).toBe(1);
        expect(account.serviceControlPolicies![0].TemplateResource.policyName).toBe('TestPolicy');
    });

    test('can attach Policy to OrganizationalUnit', async () => {
        const template = TemplateRoot.createFromContents(`
Organization:
  MasterAccount:
    Type: OC::ORG::MasterAccount
    Properties:
      AccountName: Master Account
      AccountId: '123456789012'
      RootEmail: master@example.com

  TestOU:
    Type: OC::ORG::OrganizationalUnit
    Properties:
      OrganizationalUnitName: Test OU
      ServiceControlPolicies:
        - !Ref TagPolicy
        - !Ref BackupPolicy

  TagPolicy:
    Type: OC::ORG::Policy
    Properties:
      PolicyName: TagPolicy
      PolicyType: TAG_POLICY
      PolicyDocument:
        tags: {}

  BackupPolicy:
    Type: OC::ORG::Policy
    Properties:
      PolicyName: BackupPolicy
      PolicyType: BACKUP_POLICY
      PolicyDocument:
        plans: {}
`, './');

        const ou = template.organizationSection.organizationalUnits[0];
        expect(ou.serviceControlPolicies).toBeDefined();
        expect(ou.serviceControlPolicies.length).toBe(2);
        expect((ou.serviceControlPolicies[0].TemplateResource as any).policyType).toBe('TAG_POLICY');
        expect((ou.serviceControlPolicies[1].TemplateResource as any).policyType).toBe('BACKUP_POLICY');
    });

    test('can attach mixed ServiceControlPolicy and Policy to OrganizationRoot', async () => {
        const template = TemplateRoot.createFromContents(`
Organization:
  MasterAccount:
    Type: OC::ORG::MasterAccount
    Properties:
      AccountName: Master Account
      AccountId: '123456789012'
      RootEmail: master@example.com

  OrganizationRoot:
    Type: OC::ORG::OrganizationRoot
    Properties:
      ServiceControlPolicies:
        - !Ref LegacySCP
        - !Ref NewRCP

  LegacySCP:
    Type: OC::ORG::ServiceControlPolicy
    Properties:
      PolicyName: LegacyPolicy
      PolicyDocument:
        Version: '2012-10-17'
        Statement: []

  NewRCP:
    Type: OC::ORG::Policy
    Properties:
      PolicyName: NewRCPPolicy
      PolicyType: RESOURCE_CONTROL_POLICY
      PolicyDocument:
        Version: '2012-10-17'
        Statement: []
`, './');

        const root = template.organizationSection.organizationRoot;
        expect(root!.serviceControlPolicies).toBeDefined();
        expect(root!.serviceControlPolicies.length).toBe(2);
        
        // First should be ServiceControlPolicy
        expect(root!.serviceControlPolicies[0].TemplateResource.type).toBe(OrgResourceTypes.ServiceControlPolicy);
        
        // Second should be Policy with RCP type
        expect(root!.serviceControlPolicies[1].TemplateResource.type).toBe(OrgResourceTypes.Policy);
        expect((root!.serviceControlPolicies[1].TemplateResource as any).policyType).toBe('RESOURCE_CONTROL_POLICY');
    });
});

describe('when validating Policy resources', () => {
    test('throws error when PolicyType is missing', () => {
        expect(() => {
            TemplateRoot.createFromContents(`
Organization:
  MasterAccount:
    Type: OC::ORG::MasterAccount
    Properties:
      AccountName: Master Account
      AccountId: '123456789012'
      RootEmail: master@example.com

  TestPolicy:
    Type: OC::ORG::Policy
    Properties:
      PolicyName: TestPolicy
      PolicyDocument:
        Version: '2012-10-17'
        Statement: []
`, './');
        }).toThrowError(/PolicyType/);
    });

    test('throws error when PolicyName is missing', () => {
        expect(() => {
            TemplateRoot.createFromContents(`
Organization:
  MasterAccount:
    Type: OC::ORG::MasterAccount
    Properties:
      AccountName: Master Account
      AccountId: '123456789012'
      RootEmail: master@example.com

  TestPolicy:
    Type: OC::ORG::Policy
    Properties:
      PolicyType: SERVICE_CONTROL_POLICY
      PolicyDocument:
        Version: '2012-10-17'
        Statement: []
`, './');
        }).toThrowError(/PolicyName/);
    });

    test('throws error when PolicyDocument is missing', () => {
        expect(() => {
            TemplateRoot.createFromContents(`
Organization:
  MasterAccount:
    Type: OC::ORG::MasterAccount
    Properties:
      AccountName: Master Account
      AccountId: '123456789012'
      RootEmail: master@example.com

  TestPolicy:
    Type: OC::ORG::Policy
    Properties:
      PolicyName: TestPolicy
      PolicyType: SERVICE_CONTROL_POLICY
`, './');
        }).toThrowError(/PolicyDocument/);
    });
});
