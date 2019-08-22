import { expect } from 'chai';
import * as fs from 'fs';
import * as Sinon from 'sinon';
import { AwsOrganization } from '../../src/aws-provider/aws-organization';
import { OrganizationBinder } from '../../src/org-binder/org-binder';
import { TaskProvider } from '../../src/org-binder/org-tasks-provider';
import { TemplateRoot } from '../../src/parser/parser';
import { DefaultTemplate, DefaultTemplateWriter } from '../../src/writer/default-template-writer';

const sampleOrg = JSON.parse(fs.readFileSync('./test/mny/sample-org.mock.json').toString()) as AwsOrganization;
sampleOrg.initialize = async () => {};

describe('when writing default template', () => {
    let template: DefaultTemplate;
    let taskProvider: TaskProvider;
    const sandbox = Sinon.createSandbox();

    beforeEach(async () => {
        taskProvider = (sandbox.createStubInstance(TaskProvider) as unknown) as TaskProvider;
        const writer = new DefaultTemplateWriter(sampleOrg);
        template = await writer.generateDefaultTemplate();
        fs.writeFileSync('./test/mny/sample-org.default-template.yml', template.template);
        template.state.save('./test/mny/sample-org.default-state.json');
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('then template can be read', async () => {
        const result = TemplateRoot.createFromContents(template.template);
        expect(result).to.not.be.undefined;
    });

    it('then bindings all evaluate to action none', async () => {
        const result = TemplateRoot.createFromContents(template.template);
        const binding = new OrganizationBinder(result, template.state, taskProvider);
        const bindings = binding.getOrganizationBindings();

        const accountNotNone = bindings.accounts.find((x) => x.action !== 'None');
        expect(accountNotNone).to.be.undefined;

        const organizationalUnitNotNone = bindings.organizationalUnits.find((x) => x.action !== 'None');
        expect(organizationalUnitNotNone).to.be.undefined;

        const policyNotNone = bindings.policies.find((x) => x.action !== 'None');
        expect(policyNotNone).to.be.undefined;
    });
});
