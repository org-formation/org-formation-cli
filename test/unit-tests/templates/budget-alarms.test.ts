import { CloudFormationBinder, ICfnBinding } from '~cfn-binder/cfn-binder';
import { OrgResourceTypes } from '~parser/model/resource-types';
import { TemplateRoot } from '~parser/parser';
import { PersistedState } from '~state/persisted-state';
import { ICfnRefValue, ICfnTemplate } from '../cfn-types';

describe('when loading budget alarms template', () => {
    let template: TemplateRoot;
    let cloudformationBinder: CloudFormationBinder;
    let bindings: ICfnBinding[];
    let masterBinding: ICfnBinding;
    let masterCfnTemplate: ICfnTemplate;
    let complianceBinding: ICfnBinding;
    let complianceCfnTemplate: ICfnTemplate;

    beforeEach(() => {
        template = TemplateRoot.create('./test/resources/budget-alarms/budget-alarms.yml');
        const persistedState = PersistedState.CreateEmpty('000000000000');

        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '000000000000', logicalId: 'MasterAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '333333333333', logicalId: 'SharedComplianceAccount', lastCommittedHash: 'abc'});

        cloudformationBinder = new CloudFormationBinder('budget-alarms', template, persistedState);
        bindings = cloudformationBinder.enumBindings();
        masterBinding = bindings.find((x) => x.accountId === '000000000000');
        masterCfnTemplate = JSON.parse(masterBinding.template.createTemplateBody()) as ICfnTemplate;
        complianceBinding = bindings.find((x) => x.accountId === '333333333333');
        complianceCfnTemplate = JSON.parse(complianceBinding.template.createTemplateBody()) as ICfnTemplate;
    });

    test('can create cfn bindings for template', () => {
        expect(bindings).toBeDefined();
    });

    test('creates 2 bindings for template', () => {
        expect(bindings.length).toBe(2);
    });

    test('budget for comliance account is set to 100', () => {
        const budgetResource = complianceCfnTemplate.Resources.Budget;

        expect(budgetResource).toBeDefined();
        expect(budgetResource.Properties.Budget.BudgetLimit.Amount).toBe('100');
    });

    test('notifications on compliance account go to compliance@org.com', () => {
        const budgetResource = complianceCfnTemplate.Resources.Budget;

        expect(budgetResource).toBeDefined();
        expect(budgetResource.Properties.NotificationsWithSubscribers[0].Subscribers[0].Address).toBe('compliance@org.com');
    });

    test('budget for master account is set to 500', () => {
        const budgetResource = masterCfnTemplate.Resources.Budget;

        expect(budgetResource).toBeDefined();
        expect(budgetResource.Properties.Budget.BudgetLimit.Amount).toBe('500');
    });
});
