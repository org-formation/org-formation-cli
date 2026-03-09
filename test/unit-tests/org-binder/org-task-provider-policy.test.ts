
import { AwsOrganizationWriter } from '~aws-provider/aws-organization-writer';
import { TaskProvider } from '~org-binder/org-tasks-provider';
import { OrgResourceTypes } from '~parser/model/resource-types';
import { PolicyResource } from '~parser/model/policy-resource';
import { ServiceControlPolicyResource } from '~parser/model/service-control-policy-resource';
import { TemplateRoot } from '~parser/parser';
import { PersistedState } from '~state/persisted-state';

describe('when creating tasks for Policy resources', () => {
    let template: TemplateRoot;
    let state: PersistedState;
    let writer: AwsOrganizationWriter;
    let taskProvider: TaskProvider;

    beforeEach(() => {
        state = PersistedState.CreateEmpty('123456789012');
        writer = {
            createGenericPolicy: jest.fn().mockResolvedValue('p-12345678'),
            updateGenericPolicy: jest.fn().mockResolvedValue(undefined),
            deletePolicy: jest.fn().mockResolvedValue(undefined),
            attachGenericPolicy: jest.fn().mockResolvedValue(undefined),
        } as any;

        template = TemplateRoot.createFromContents(`
Organization:
  MasterAccount:
    Type: OC::ORG::MasterAccount
    Properties:
      AccountName: Master Account
      AccountId: '123456789012'
      RootEmail: master@example.com
`, './');

        taskProvider = new TaskProvider(template, state, writer);
    });

    test('creates tasks for new Policy resource', () => {
        const policyTemplate = TemplateRoot.createFromContents(`
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

        const policy = policyTemplate.organizationSection.policies[0];
        const tasks = taskProvider.createPolicyCreateTasks(policy, 'hash123');

        expect(tasks).toBeDefined();
        expect(tasks.length).toBe(2); // Create task + CommitHash task
        expect(tasks[0].action).toBe('Create');
        expect(tasks[0].type).toBe(OrgResourceTypes.Policy);
        expect(tasks[1].action).toBe('CommitHash');
    });

    test('create task calls createGenericPolicy for Policy resource', async () => {
        const policyTemplate = TemplateRoot.createFromContents(`
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
      PolicyType: TAG_POLICY
      PolicyDocument:
        tags: {}
`, './');

        const policy = policyTemplate.organizationSection.policies[0];
        const tasks = taskProvider.createPolicyCreateTasks(policy, 'hash123');

        await tasks[0].perform(tasks[0]);

        expect(writer.createGenericPolicy).toHaveBeenCalledWith(policy);
        expect(tasks[0].result).toBe('p-12345678');
    });

    test('creates update tasks for existing Policy resource', () => {
        const binding = {
            type: OrgResourceTypes.Policy,
            logicalId: 'TestPolicy',
            physicalId: 'p-12345678',
            lastCommittedHash: 'oldhash',
        };

        const policyTemplate = TemplateRoot.createFromContents(`
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
      PolicyType: BACKUP_POLICY
      Description: Updated description
      PolicyDocument:
        plans: {}
`, './');

        const policy = policyTemplate.organizationSection.policies[0];
        const tasks = taskProvider.createPolicyUpdateTasks(policy, binding, 'newhash');

        expect(tasks).toBeDefined();
        expect(tasks.length).toBe(2); // Update task + CommitHash task
        expect(tasks[0].action).toBe('Update');
        expect(tasks[0].type).toBe(OrgResourceTypes.Policy);
    });

    test('update task calls updateGenericPolicy for Policy resource', async () => {
        const binding = {
            type: OrgResourceTypes.Policy,
            logicalId: 'TestPolicy',
            physicalId: 'p-12345678',
            lastCommittedHash: 'oldhash',
        };

        const policyTemplate = TemplateRoot.createFromContents(`
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
      PolicyType: AISERVICES_OPT_OUT_POLICY
      PolicyDocument:
        services: {}
`, './');

        const policy = policyTemplate.organizationSection.policies[0];
        const tasks = taskProvider.createPolicyUpdateTasks(policy, binding, 'newhash');

        await tasks[0].perform(tasks[0]);

        expect(writer.updateGenericPolicy).toHaveBeenCalledWith(policy, 'p-12345678');
    });

    test('creates delete tasks for removed Policy resource', () => {
        const binding = {
            type: OrgResourceTypes.Policy,
            logicalId: 'TestPolicy',
            physicalId: 'p-12345678',
            lastCommittedHash: 'somehash',
        };

        const tasks = taskProvider.createPolicyDeleteTasks(binding);

        expect(tasks).toBeDefined();
        expect(tasks.length).toBe(1);
        expect(tasks[0].action).toBe('Delete');
        expect(tasks[0].type).toBe(OrgResourceTypes.Policy);
    });

    test('delete task calls deletePolicy', async () => {
        const binding = {
            type: OrgResourceTypes.Policy,
            logicalId: 'TestPolicy',
            physicalId: 'p-12345678',
            lastCommittedHash: 'somehash',
        };

        const tasks = taskProvider.createPolicyDeleteTasks(binding);

        await tasks[0].perform(tasks[0]);

        expect(writer.deletePolicy).toHaveBeenCalledWith('p-12345678');
    });

    test('handles ServiceControlPolicy with legacy createPolicy method', async () => {
        writer.createPolicy = jest.fn().mockResolvedValue('p-87654321');

        const scpTemplate = TemplateRoot.createFromContents(`
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
`, './');

        const scp = scpTemplate.organizationSection.serviceControlPolicies[0];
        const tasks = taskProvider.createPolicyCreateTasks(scp, 'hash123');

        await tasks[0].perform(tasks[0]);

        expect(writer.createPolicy).toHaveBeenCalledWith(scp);
        expect(writer.createGenericPolicy).not.toHaveBeenCalled();
    });

    test('creates tasks with partition support', () => {
        const partitionWriter = {
            createGenericPolicy: jest.fn().mockResolvedValue('p-partition123'),
        } as any;

        const taskProviderWithPartition = new TaskProvider(template, state, writer, partitionWriter);

        const policyTemplate = TemplateRoot.createFromContents(`
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
      PolicyType: SECURITYHUB_POLICY
      PolicyDocument:
        Version: '2012-10-17'
        Statement: []
`, './');

        const policy = policyTemplate.organizationSection.policies[0];
        const tasks = taskProviderWithPartition.createPolicyCreateTasks(policy, 'hash123', true);

        expect(tasks.length).toBe(3); // Create task + Partition create task + CommitHash task
        expect(tasks[0].action).toBe('Create');
        expect(tasks[1].action).toBe('Create');
        expect(tasks[2].action).toBe('CommitHash');
    });

    test('commit hash task stores both physicalId and partitionId', async () => {
        const partitionWriter = {
            createGenericPolicy: jest.fn().mockResolvedValue('p-partition123'),
        } as any;

        const taskProviderWithPartition = new TaskProvider(template, state, writer, partitionWriter);

        const policyTemplate = TemplateRoot.createFromContents(`
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
      PolicyType: INSPECTOR_POLICY
      PolicyDocument:
        Version: '2012-10-17'
        Statement: []
`, './');

        const policy = policyTemplate.organizationSection.policies[0];
        const tasks = taskProviderWithPartition.createPolicyCreateTasks(policy, 'hash123', true);

        // Execute create tasks
        await tasks[0].perform(tasks[0]);
        await tasks[1].perform(tasks[1]);
        
        // Execute commit hash task
        await tasks[2].perform(tasks[2]);

        const binding = state.getBinding(OrgResourceTypes.Policy, 'TestPolicy');
        expect(binding).toBeDefined();
        expect(binding.physicalId).toBe('p-12345678');
        expect(binding.partitionId).toBe('p-partition123');
        expect(binding.lastCommittedHash).toBe('hash123');
    });
});

describe('when creating attach/detach tasks for Policy resources', () => {
    let template: TemplateRoot;
    let state: PersistedState;
    let writer: AwsOrganizationWriter;

    beforeEach(() => {
        state = PersistedState.CreateEmpty('123456789012');
        writer = {
            attachGenericPolicy: jest.fn().mockResolvedValue(undefined),
            attachPolicy: jest.fn().mockResolvedValue(undefined),
            detachPolicy: jest.fn().mockResolvedValue(undefined),
        } as any;

        // Set up existing policy binding
        state.setBinding({
            type: OrgResourceTypes.Policy,
            logicalId: 'TestPolicy',
            physicalId: 'p-12345678',
            lastCommittedHash: 'hash123',
        });
    });

    test('attach task uses attachGenericPolicy for Policy resource', async () => {
        // Set up MasterAccount binding
        state.setBinding({
            type: OrgResourceTypes.MasterAccount,
            logicalId: 'MasterAccount',
            physicalId: '123456789012',
            lastCommittedHash: 'hash000',
        });

        template = TemplateRoot.createFromContents(`
Organization:
  MasterAccount:
    Type: OC::ORG::MasterAccount
    Properties:
      AccountName: Master Account
      AccountId: '123456789012'
      RootEmail: master@example.com
      ServiceControlPolicies: !Ref TestPolicy

  TestPolicy:
    Type: OC::ORG::Policy
    Properties:
      PolicyName: TestPolicy
      PolicyType: BEDROCK_POLICY
      PolicyDocument:
        Version: '2012-10-17'
        Statement: []
`, './');

        const taskProvider = new TaskProvider(template, state, writer);
        const masterAccount = template.organizationSection.masterAccount;
        const tasks = taskProvider.createAccountUpdateTasks(masterAccount!, state.getBinding(OrgResourceTypes.MasterAccount, 'MasterAccount'), 'hash456', false);

        // Find attach policy task
        const attachTask = tasks.find(t => t.action.startsWith('Attach Policy'));
        expect(attachTask).toBeDefined();

        await attachTask!.perform(attachTask!);

        expect(writer.attachGenericPolicy).toHaveBeenCalledWith(
            '123456789012',
            'p-12345678',
            'BEDROCK_POLICY'
        );
    });

    test('attach task uses attachPolicy for ServiceControlPolicy resource', async () => {
        // Set up MasterAccount binding
        state.setBinding({
            type: OrgResourceTypes.MasterAccount,
            logicalId: 'MasterAccount',
            physicalId: '123456789012',
            lastCommittedHash: 'hash000',
        });

        state.setBinding({
            type: OrgResourceTypes.ServiceControlPolicy,
            logicalId: 'LegacySCP',
            physicalId: 'p-87654321',
            lastCommittedHash: 'hash123',
        });

        template = TemplateRoot.createFromContents(`
Organization:
  MasterAccount:
    Type: OC::ORG::MasterAccount
    Properties:
      AccountName: Master Account
      AccountId: '123456789012'
      RootEmail: master@example.com
      ServiceControlPolicies: !Ref LegacySCP

  LegacySCP:
    Type: OC::ORG::ServiceControlPolicy
    Properties:
      PolicyName: LegacyPolicy
      PolicyDocument:
        Version: '2012-10-17'
        Statement: []
`, './');

        const taskProvider = new TaskProvider(template, state, writer);
        const masterAccount = template.organizationSection.masterAccount;
        const tasks = taskProvider.createAccountUpdateTasks(masterAccount!, state.getBinding(OrgResourceTypes.MasterAccount, 'MasterAccount'), 'hash456', false);

        // Find attach policy task
        const attachTask = tasks.find(t => t.action.startsWith('Attach Policy'));
        expect(attachTask).toBeDefined();

        await attachTask!.perform(attachTask!);

        expect(writer.attachPolicy).toHaveBeenCalledWith('123456789012', 'p-87654321');
        expect(writer.attachGenericPolicy).not.toHaveBeenCalled();
    });
});
