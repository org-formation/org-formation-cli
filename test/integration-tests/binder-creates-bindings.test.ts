import { assert, expect} from 'chai';
import * as fs from 'fs';
import * as Sinon from 'sinon';
import { AwsOrganization } from '../../src/aws-provider/aws-organization';
import { OrganizationBinder, OrganizationBinding } from '../../src/org-binder/org-binder';
import { TaskProvider } from '../../src/org-binder/org-tasks-provider';
import { IOrganizationalUnitProperties, OrganizationalUnitResource } from '../../src/parser/model/organizational-unit-resource';
import { TemplateRoot } from '../../src/parser/parser';
import { PersistedState } from '../../src/state/persisted-state';
import { FileStorageProvider } from '../../src/state/storage-provider';
const sampleOrg = JSON.parse(fs.readFileSync('./test/mny/sample-org.mock.json').toString()) as AwsOrganization;
const sampleTemplate = TemplateRoot.create('./test/mny/sample-org.template.yml');
const emptyState = PersistedState.CreateEmpty(sampleOrg.masterAccount.Id);

sampleOrg.initialize = async () => { };

describe('when binding template with empty state', () => {
    let binder: OrganizationBinder;
    let organizationalBindings: OrganizationBinding;
    const sandbox = Sinon.createSandbox();

    beforeEach(async () => {
        const taskProvider = sandbox.createStubInstance(TaskProvider);
        binder = new OrganizationBinder(sampleTemplate, emptyState, (taskProvider as unknown) as TaskProvider);
        organizationalBindings = binder.getOrganizationBindings();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('then all bindings are set to create', async () => {
        const accountNotCreate = organizationalBindings.accounts.find((x) => x.action !== 'Create');
        expect(accountNotCreate).to.be.undefined;

        const policyNotCreate = organizationalBindings.policies.find((x) => x.action !== 'Create');
        expect(policyNotCreate).to.be.undefined;

        const organizationalUnitNotCreate = organizationalBindings.organizationalUnits.find((x) => x.action !== 'Create');
        expect(organizationalUnitNotCreate).to.be.undefined;
    });

});

describe('when removing ou to account reference in template', () => {
    let binder: OrganizationBinder;
    let template: TemplateRoot;
    let organizationalBindings: OrganizationBinding;
    let developmentOUResource: OrganizationalUnitResource;
    const sandbox = Sinon.createSandbox();

    beforeEach(async () => {

        const storageProvider = new FileStorageProvider('./test/mny/sample-org.state.json');
        const defaultState = await PersistedState.Load(storageProvider);

        const taskProvider = sandbox.createStubInstance(TaskProvider);
        template = sampleTemplate.clone();
        developmentOUResource = template.organizationSection.organizationalUnits.find((x) => x.organizationalUnitName === 'development');
        (((developmentOUResource as any).resource.Properties as IOrganizationalUnitProperties).Accounts as []).pop();

        binder = new OrganizationBinder(template, defaultState, (taskProvider as unknown) as TaskProvider);
        organizationalBindings = binder.getOrganizationBindings();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('then organizational unit binding is set to update', async () => {
        const developmentOU = organizationalBindings.organizationalUnits.find((x) => x.template.logicalId === developmentOUResource.logicalId);
        expect(developmentOU.action).to.eq('Update');
    });

});
