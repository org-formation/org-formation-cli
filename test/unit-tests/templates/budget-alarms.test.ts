import { expect } from 'chai';
import { CloudFormationBinder, ICfnBinding } from '../../../src/cfn-binder/cfn-binder';
import { OrgResourceTypes } from '../../../src/parser/model/resource-types';
import { TemplateRoot } from '../../../src/parser/parser';
import { PersistedState } from '../../../src/state/persisted-state';
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
        const persistedState = PersistedState.CreateEmpty(template.organizationSection.masterAccount.accountId);

        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '000000000000', logicalId: 'MasterAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '333333333333', logicalId: 'SharedComplianceAccount', lastCommittedHash: 'abc'});

        cloudformationBinder = new CloudFormationBinder('budget-alarms', template, persistedState);
        bindings = cloudformationBinder.enumBindings();
        masterBinding = bindings.find((x) => x.accountId === '000000000000');
        masterCfnTemplate = JSON.parse(masterBinding.template.createTemplateBody()) as ICfnTemplate;
        complianceBinding = bindings.find((x) => x.accountId === '333333333333');
        complianceCfnTemplate = JSON.parse(complianceBinding.template.createTemplateBody()) as ICfnTemplate;
    });

    it('can create cfn bindings for template', () => {
        expect(bindings).to.not.be.undefined;
    });

    it('creates 2 bindings for template', () => {
        expect(bindings.length).to.eq(2);
    });

    it('budget for comliance account is set to 100', () => {
        const budgetResource = complianceCfnTemplate.Resources.Budget;

        expect(budgetResource).to.not.be.undefined;
        expect(budgetResource.Properties.Budget.BudgetLimit.Amount).to.eq('100');
    });

    it('notifications on compliance account go to compliance@org.com', () => {
        const budgetResource = complianceCfnTemplate.Resources.Budget;

        expect(budgetResource).to.not.be.undefined;
        expect(budgetResource.Properties.NotificationsWithSubscribers[0].Subscribers[0].Address).to.eq('compliance@org.com');
    });

    it('budget for master account is set to 500', () => {
        const budgetResource = masterCfnTemplate.Resources.Budget;

        expect(budgetResource).to.not.be.undefined;
        expect(budgetResource.Properties.Budget.BudgetLimit.Amount).to.eq('500');
    });
});
