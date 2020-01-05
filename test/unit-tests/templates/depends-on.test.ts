import { expect } from 'chai';
import { CloudFormationBinder, ICfnBinding } from '../../../src/cfn-binder/cfn-binder';
import { OrgResourceTypes } from '../../../src/parser/model/resource-types';
import { TemplateRoot } from '../../../src/parser/parser';
import { PersistedState } from '../../../src/state/persisted-state';
import { ICfnRefValue, ICfnTemplate } from '../cfn-types';
import { TestTemplates } from '../test-templates';

describe('when filtering out depends on', () => {
    let template: TemplateRoot;
    let cloudformationBinder: CloudFormationBinder;
    let bindings: ICfnBinding[];
    let account1Binding: ICfnBinding;
    let account1CfnTemplate: ICfnTemplate;
    let account2Binding: ICfnBinding;
    let account2CfnTemplate: ICfnTemplate;

    beforeEach(() => {
        template = TemplateRoot.create('./test/resources/depends-on/depends-on.yml');
        const persistedState = TestTemplates.createState(template);
        cloudformationBinder = new CloudFormationBinder('budget-alarms', template, persistedState);
        bindings = cloudformationBinder.enumBindings();
        account1Binding = bindings.find((x) => x.accountId === '111111111111');
        account1CfnTemplate = JSON.parse(account1Binding.template.createTemplateBody()) as ICfnTemplate;
        account2Binding = bindings.find((x) => x.accountId === '222222222222');
        account2CfnTemplate = JSON.parse(account2Binding.template.createTemplateBody()) as ICfnTemplate;
    });

    it('removes DependsOn (string) to resource in other template', () => {
        const resource1 = account2CfnTemplate.Resources.Resource1;
        expect(resource1.DependsOn).to.not.be.undefined;
        expect(resource1.DependsOn.length).to.eq(0);
    });

    it('removes DependsOn (list) to resource in other template', () => {
        const resource1 = account2CfnTemplate.Resources.Resource2;
        expect(resource1.DependsOn).to.not.be.undefined;
        expect(resource1.DependsOn.length).to.eq(0);
    });

    it('keeps DependsOn (string) to resource in same template', () => {
        const resource1 = account1CfnTemplate.Resources.Resource1;
        expect(resource1.DependsOn).to.not.be.undefined;
        expect(resource1.DependsOn).to.eq('Dependency');
    });

    it('keeps DependsOn (list) to resource in same template', () => {
        const resource1 = account1CfnTemplate.Resources.Resource2;
        expect(resource1.DependsOn).to.not.be.undefined;
        expect(resource1.DependsOn[0]).to.eq('Dependency');
    });
});
