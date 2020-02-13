import { CloudFormationBinder, ICfnBinding } from '../../../src/cfn-binder/cfn-binder';
import { OrgResourceTypes } from '../../../src/parser/model/resource-types';
import { TemplateRoot } from '../../../src/parser/parser';
import { PersistedState } from '../../../src/state/persisted-state';
import { ICfnTemplate } from '../cfn-types';


describe('when creating a cross account depedency on a resource that has a condition', () => {
    let template: TemplateRoot;
    let cloudformationBinder: CloudFormationBinder;
    let bindings: ICfnBinding[];
    let account1Binding: ICfnBinding;
    let account1CfnTemplate: ICfnTemplate;
    let account2Binding: ICfnBinding;
    let account2CfnTemplate: ICfnTemplate;

    beforeEach(() => {
        template = TemplateRoot.create('./test/resources/conditionals/conditionals.yml');
        const persistedState = PersistedState.CreateEmpty(template.organizationSection.masterAccount.accountId);
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '111111111111', logicalId: 'Account1', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '222222222222', logicalId: 'Account2', lastCommittedHash: 'abc'});

        cloudformationBinder = new CloudFormationBinder('conditionals', template, persistedState);
        bindings = cloudformationBinder.enumBindings();
        account1Binding = bindings.find((x) => x.accountId === '111111111111');
        account1CfnTemplate = JSON.parse(account1Binding.template.createTemplateBody()) as ICfnTemplate;
        account2Binding = bindings.find((x) => x.accountId === '222222222222');
        account2CfnTemplate = JSON.parse(account2Binding.template.createTemplateBody()) as ICfnTemplate;
    });

    test('can create cfn bindings for template', () => {
        expect(bindings).toBeDefined();
    });

    test('generated output has condition', () => {
        expect(account1CfnTemplate.Outputs).toBeDefined();
        const output = account1CfnTemplate.Outputs.conditionalsDashBucketWithCondition;
        expect(output).toBeDefined();
        expect(output.Condition).toBeDefined();
    });
    test('condition on output is same as on bucket', () => {
        expect(account1CfnTemplate.Outputs).toBeDefined();
        const output = account1CfnTemplate.Outputs.conditionalsDashBucketWithCondition;
        const bucket = account1CfnTemplate.Resources.BucketWithCondition;
        expect(output).toBeDefined();
        expect(output.Condition).toBeDefined();
        expect(bucket).toBeDefined();
        expect(bucket.Condition).toBeDefined();
        expect(output.Condition).toBe(bucket.Condition);
    });
    test('output is removed where in template that does not have resoruce', () => {
        expect(account2CfnTemplate.Outputs).toBeDefined();
        expect(account2CfnTemplate.Outputs.Bucket).toBeUndefined();
    });
});
