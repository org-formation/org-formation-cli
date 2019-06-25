import { assert, expect} from 'chai';
import * as fs from 'fs';
import { AwsOrganization } from '../../src/aws-provider/aws-organization';
import { Binder, OrganizationBinding } from '../../src/binder/binder';
import { OrganizationalUnitResource } from '../../src/parser/model/organizational-unit-resource';
import { TemplateRoot } from '../../src/parser/parser';
import { PersistedState } from '../../src/state/persisted-state';
const sampleOrg = JSON.parse(fs.readFileSync('./test/data/sample-org.mock.json').toString()) as AwsOrganization;
const sampleTemplate = TemplateRoot.create('./test/data/sample-org.template.yml');
const emptyState = PersistedState.CreateEmpty(sampleOrg.masterAccount.Id);
const defaultState = PersistedState.Load('./test/data/sample-org.state.json');

sampleOrg.initialize = async () => { };

describe('when binding template with empty state', () => {
    let binder: Binder;
    let organizationalBindings: OrganizationBinding;

    beforeEach(async () => {
        binder = new Binder(sampleTemplate, emptyState);
        organizationalBindings = binder.getOrganizationBindings();
    });

    it('then every resource has binding', async () => {
        expect(organizationalBindings.accounts.length).to.eq(sampleTemplate.organizationSection.accounts.length);
        expect(organizationalBindings.organizationalUnits.length).to.eq(sampleTemplate.organizationSection.organizationalUnits.length);
        expect(organizationalBindings.policies.length).to.eq(sampleTemplate.organizationSection.serviceControlPolicies.length);
        expect(organizationalBindings.masterAccount).to.not.be.undefined;
    });

    it('then all bindings are set to create', async () => {
        const accountNotCreate = organizationalBindings.accounts.find((x) => x.action != 'Create');
        expect(accountNotCreate).to.be.undefined;

        const policyNotCreate = organizationalBindings.policies.find((x) => x.action != 'Create');
        expect(policyNotCreate).to.be.undefined;

        const organizationalUnitNotCreate = organizationalBindings.organizationalUnits.find((x) => x.action != 'Create');
        expect(organizationalUnitNotCreate).to.be.undefined;
    });

});

describe('when removing ou to account reference in template', () => {
    let binder: Binder;
    let template: TemplateRoot;
    let organizationalBindings: OrganizationBinding;
    let developmentOUResource: OrganizationalUnitResource;

    beforeEach(async () => {
        template = sampleTemplate.clone();
        developmentOUResource = template.organizationSection.organizationalUnits.find((x) => x.organizationalUnitName === 'development');
        developmentOUResource.accounts.pop();

        binder = new Binder(template, defaultState);
        organizationalBindings = binder.getOrganizationBindings();
    });

    it('then organizational unit binding is set to update', async () => {
        const developmentOU = organizationalBindings.organizationalUnits.find((x) => x.template.logicalId == developmentOUResource.logicalId);
        expect(developmentOU.action).to.eq('Update');
    });

});
