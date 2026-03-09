
import { OrganizationBinder } from '~org-binder/org-binder';
import { TaskProvider } from '~org-binder/org-tasks-provider';
import { OrgResourceTypes } from '~parser/model/resource-types';
import { TemplateRoot } from '~parser/parser';
import { PersistedState } from '~state/persisted-state';

describe('when binding Policy resources', () => {
    let template: TemplateRoot;
    let state: PersistedState;
    let taskProvider: TaskProvider;
    let binder: OrganizationBinder;

    beforeEach(() => {
        state = PersistedState.CreateEmpty('123456789012');
        taskProvider = {} as any; // Mock task provider
    });

    test('enumerates Policy resources correctly', () => {
        template = TemplateRoot.createFromContents(`
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
      PolicyType: RESOURCE_CONTROL_POLICY
      PolicyDocument:
        Version: '2012-10-17'
        Statement: []
`, './');

        binder = new OrganizationBinder(template, state, taskProvider);
        const bindings = binder.getOrganizationBinding();

        expect(bindings.policies).toBeDefined();
        expect(bindings.policies.length).toBe(1);
        expect(bindings.policies[0].template.policyName).toBe('TestPolicy');
        expect((bindings.policies[0].template as any).policyType).toBe('RESOURCE_CONTROL_POLICY');
        expect(bindings.policies[0].action).toBe('Create');
    });

    test('enumerates both ServiceControlPolicy and Policy resources', () => {
        template = TemplateRoot.createFromContents(`
Organization:
  MasterAccount:
    Type: OC::ORG::MasterAccount
    Properties:
      AccountName: Master Account
      AccountId: '123456789012'
      RootEmail: master@example.com

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
      PolicyType: TAG_POLICY
      PolicyDocument:
        tags: {}
`, './');

        binder = new OrganizationBinder(template, state, taskProvider);
        const bindings = binder.getOrganizationBinding();

        expect(bindings.policies).toBeDefined();
        expect(bindings.policies.length).toBe(2);
        
        const legacyPolicy = bindings.policies.find(p => p.template.policyName === 'LegacyPolicy');
        expect(legacyPolicy).toBeDefined();
        expect(legacyPolicy!.template.type).toBe(OrgResourceTypes.ServiceControlPolicy);

        const newPolicy = bindings.policies.find(p => p.template.policyName === 'NewPolicy');
        expect(newPolicy).toBeDefined();
        expect(newPolicy!.template.type).toBe(OrgResourceTypes.Policy);
        expect((newPolicy!.template as any).policyType).toBe('TAG_POLICY');
    });

    test('marks Policy for update when hash changes', () => {
        // Create initial state with existing policy
        state.setBinding({
            type: OrgResourceTypes.Policy,
            logicalId: 'TestPolicy',
            physicalId: 'p-12345678',
            lastCommittedHash: 'oldhash',
        });

        template = TemplateRoot.createFromContents(`
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
      PolicyType: RESOURCE_CONTROL_POLICY
      Description: Updated description
      PolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Deny
            Action: '*'
            Resource: '*'
`, './');

        binder = new OrganizationBinder(template, state, taskProvider);
        const bindings = binder.getOrganizationBinding();

        expect(bindings.policies.length).toBe(1);
        expect(bindings.policies[0].action).toBe('Update');
        expect(bindings.policies[0].state.physicalId).toBe('p-12345678');
    });

    test('marks Policy for delete when removed from template', () => {
        // Create initial state with existing policy
        state.setBinding({
            type: OrgResourceTypes.Policy,
            logicalId: 'TestPolicy',
            physicalId: 'p-12345678',
            lastCommittedHash: 'somehash',
        });

        template = TemplateRoot.createFromContents(`
Organization:
  MasterAccount:
    Type: OC::ORG::MasterAccount
    Properties:
      AccountName: Master Account
      AccountId: '123456789012'
      RootEmail: master@example.com
`, './');

        binder = new OrganizationBinder(template, state, taskProvider);
        const bindings = binder.getOrganizationBinding();

        expect(bindings.policies.length).toBe(1);
        expect(bindings.policies[0].action).toBe('Delete');
        expect(bindings.policies[0].state.physicalId).toBe('p-12345678');
    });

    test('handles multiple Policy resources with different types', () => {
        template = TemplateRoot.createFromContents(`
Organization:
  MasterAccount:
    Type: OC::ORG::MasterAccount
    Properties:
      AccountName: Master Account
      AccountId: '123456789012'
      RootEmail: master@example.com

  SCPPolicy:
    Type: OC::ORG::Policy
    Properties:
      PolicyName: SCPPolicy
      PolicyType: SERVICE_CONTROL_POLICY
      PolicyDocument:
        Version: '2012-10-17'
        Statement: []

  RCPPolicy:
    Type: OC::ORG::Policy
    Properties:
      PolicyName: RCPPolicy
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
        tags: {}

  BackupPolicy:
    Type: OC::ORG::Policy
    Properties:
      PolicyName: BackupPolicy
      PolicyType: BACKUP_POLICY
      PolicyDocument:
        plans: {}
`, './');

        binder = new OrganizationBinder(template, state, taskProvider);
        const bindings = binder.getOrganizationBinding();

        expect(bindings.policies.length).toBe(4);
        
        const policyTypes = bindings.policies.map(p => (p.template as any).policyType);
        expect(policyTypes).toContain('SERVICE_CONTROL_POLICY');
        expect(policyTypes).toContain('RESOURCE_CONTROL_POLICY');
        expect(policyTypes).toContain('TAG_POLICY');
        expect(policyTypes).toContain('BACKUP_POLICY');
    });

    test('preserves partition ID for Policy resources', () => {
        state.setBinding({
            type: OrgResourceTypes.Policy,
            logicalId: 'TestPolicy',
            physicalId: 'p-12345678',
            partitionId: 'p-partition123',
            lastCommittedHash: 'somehash',
        });

        template = TemplateRoot.createFromContents(`
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
      PolicyType: RESOURCE_CONTROL_POLICY
      PolicyDocument:
        Version: '2012-10-17'
        Statement: []
`, './');

        binder = new OrganizationBinder(template, state, taskProvider);
        const bindings = binder.getOrganizationBinding();

        expect(bindings.policies[0].state.partitionId).toBe('p-partition123');
    });
});

describe('when binding Policy attachments', () => {
    let template: TemplateRoot;
    let state: PersistedState;

    beforeEach(() => {
        state = PersistedState.CreateEmpty('123456789012');
    });

    test('resolves Policy references on Account', () => {
        template = TemplateRoot.createFromContents(`
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
      ServiceControlPolicies:
        - !Ref RCPPolicy
        - !Ref TagPolicy

  RCPPolicy:
    Type: OC::ORG::Policy
    Properties:
      PolicyName: RCPPolicy
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
        tags: {}
`, './');

        const account = template.organizationSection.accounts[0];
        expect(account.serviceControlPolicies).toBeDefined();
        expect(account.serviceControlPolicies!.length).toBe(2);
        expect(account.serviceControlPolicies![0].TemplateResource.policyName).toBe('RCPPolicy');
        expect(account.serviceControlPolicies![1].TemplateResource.policyName).toBe('TagPolicy');
    });

    test('resolves mixed ServiceControlPolicy and Policy references', () => {
        template = TemplateRoot.createFromContents(`
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

        const ou = template.organizationSection.organizationalUnits[0];
        expect(ou.serviceControlPolicies).toBeDefined();
        expect(ou.serviceControlPolicies.length).toBe(2);
        
        expect(ou.serviceControlPolicies[0].TemplateResource.type).toBe(OrgResourceTypes.ServiceControlPolicy);
        expect(ou.serviceControlPolicies[1].TemplateResource.type).toBe(OrgResourceTypes.Policy);
    });
});
