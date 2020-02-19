import * as Sinon from 'sinon';
import { IBuildTask, TaskProvider } from '../../../src/org-binder/org-tasks-provider';
import { TestTemplates } from '../test-templates';
import { AwsOrganizationWriter } from '../../../src/aws-provider/aws-organization-writer';
import { OrgResourceTypes } from '../../../src/parser/model/resource-types';
import { OrganizationalUnitResource } from '../../../src/parser/model/organizational-unit-resource';

describe('when creating OU', () => {
    const sandbox = Sinon.createSandbox()
    let taskProvider: TaskProvider;
    let awsOrganizationWriterStub: Sinon.SinonStubbedInstance<AwsOrganizationWriter>;
    let buildTasks: IBuildTask[];

    beforeEach( () => {
        const template = TestTemplates.createBasicTemplate();
        const state = TestTemplates.createState(template);
        awsOrganizationWriterStub = sandbox.createStubInstance(AwsOrganizationWriter);
        taskProvider = new TaskProvider(template, state, awsOrganizationWriterStub as unknown as AwsOrganizationWriter);

        const ou2binding = state.getBinding(OrgResourceTypes.OrganizationalUnit, 'OU2')
        state.removeBinding(ou2binding);

        const ou2Resource =  template.organizationSection.organizationalUnits.find(x=>x.logicalId === 'OU2');
        buildTasks = taskProvider.createOrganizationalUnitCreateTasks(ou2Resource, 'xxyyzz');
    });

    afterEach(() => {
        sandbox.restore();
    })

    test('Build tasks are created', () => {
        expect(buildTasks).toBeDefined;
    })

    test('OU Create Task is returned in build tasks', () => {
        const createTask = buildTasks.find(x=>x.action === 'Create');
        expect(createTask).toBeDefined;
    })

    test('Two Attach Policy task are created', () => {
        const attachPolicyTasks = buildTasks.filter(x=>x.action.startsWith('Attach Policy'));
        expect(attachPolicyTasks).toBeDefined;
        expect(attachPolicyTasks.length).toBe(2);
    })


    test('Attach account task is created', () => {
        const attachAccountTask = buildTasks.find(x=>x.action.startsWith('Attach Account'));
        expect(attachAccountTask).toBeDefined;
    })

    test('Commit Hash task is returned in build tasks', () => {
        const commitHashTask = buildTasks.find(x=>x.action === 'CommitHash');
        expect(commitHashTask).toBeDefined;
    })

    test('tasks depend on eachother', () => {
        const createTask = buildTasks.find(x=>x.action === 'Create');
        const attachPolicyTasks = buildTasks.filter(x=>x.action.startsWith('Attach Policy'));
        const attachAccountTask = buildTasks.find(x=>x.action.startsWith('Attach Account'));
        const commitHashTask = buildTasks.find(x=>x.action === 'CommitHash');

        expect(attachPolicyTasks[0].dependentTasks).toContain(createTask);
        expect(attachPolicyTasks[1].dependentTasks).toContain(createTask);
        expect(attachAccountTask.dependentTasks).toContain(createTask);
        expect(commitHashTask.dependentTasks).toContain(createTask);

    })
});

describe('when creating OU as child of other', () => {
    const sandbox = Sinon.createSandbox()
    let taskProvider: TaskProvider;
    let awsOrganizationWriterStub: Sinon.SinonStubbedInstance<AwsOrganizationWriter>;
    let buildTasks: IBuildTask[];
    let buildTaskOU: IBuildTask[];

    beforeEach( () => {
        const template = TestTemplates.createBasicTemplate();
        const state = TestTemplates.createState(template);
        state.setPreviousTemplate(template.source);
        awsOrganizationWriterStub = sandbox.createStubInstance(AwsOrganizationWriter);

        taskProvider = new TaskProvider(template, state, awsOrganizationWriterStub as unknown as AwsOrganizationWriter);

        const ou2binding = state.getBinding(OrgResourceTypes.OrganizationalUnit, 'OU2')
        state.removeBinding(ou2binding);

        const ou2Resource =  template.organizationSection.organizationalUnits.find(x=>x.logicalId === 'OU2');
        const ouResource =  template.organizationSection.organizationalUnits.find(x=>x.logicalId === 'OU');
        ouResource.organizationalUnits = [{TemplateResource: ou2Resource}];
        buildTasks = taskProvider.createOrganizationalUnitCreateTasks(ou2Resource, 'xxyyzz');
        buildTaskOU = taskProvider.createOrganizationalUnitUpdateTasks(ouResource, 'physical-OU', '131231');
    });

    afterEach(() => {
        sandbox.restore();
    })

    test('Build tasks are created', () => {
        expect(buildTasks).toBeDefined;
        expect(buildTaskOU).toBeDefined;
    })

    test('attach ou task is added to update of parent', () => {
        const attachOUTask = buildTaskOU.find(x=>x.action.startsWith('Attach OU'));
        expect(attachOUTask).toBeDefined;
    })

    test('attach ou task depends on create of child', () => {
        const attachOUTask = buildTaskOU.find(x=>x.action.startsWith('Attach OU'));
        const createTask = buildTasks.find(x=>x.action=== 'Create');
        expect(attachOUTask).toBeDefined;
        expect(createTask).toBeDefined;
        const isDependent = attachOUTask.dependentTaskFilter(createTask);
        expect(isDependent).toBe(true);
    })

    test('commit hash task is added to update of parent', () => {
        const commitHashTask = buildTaskOU.find(x=>x.action === 'CommitHash');
        expect(commitHashTask).toBeDefined;
    })

});