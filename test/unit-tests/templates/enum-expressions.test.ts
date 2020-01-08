import { expect } from 'chai';
import { CloudFormationBinder, ICfnBinding, ICfnSubValue } from '../../../src/cfn-binder/cfn-binder';
import { OrgResourceTypes } from '../../../src/parser/model/resource-types';
import { TemplateRoot } from '../../../src/parser/parser';
import { PersistedState } from '../../../src/state/persisted-state';
import { ICfnTemplate } from '../cfn-types';

describe('when resolving enum-expressions', () => {
    let template: TemplateRoot;
    let cloudformationBinder: CloudFormationBinder;
    let bindings: ICfnBinding[];
    let masterAccountTemplate: ICfnTemplate;
    beforeEach(() => {
        template = TemplateRoot.create('./test/resources/enum-expressions/enum-expressions.yml');
        const persistedState = PersistedState.CreateEmpty(template.organizationSection.masterAccount.accountId);

        persistedState.setBinding({type: OrgResourceTypes.MasterAccount, physicalId: '000000000000', logicalId: 'MasterAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '111111111111', logicalId: 'Account1', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '222222222222', logicalId: 'Account2', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '333333333333', logicalId: 'Account3', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '444444444444', logicalId: 'Account4', lastCommittedHash: 'abc'});

        cloudformationBinder = new CloudFormationBinder('enum-expressions', template, persistedState);
        bindings = cloudformationBinder.enumBindings();
        masterAccountTemplate = JSON.parse(bindings.find((x) => x.accountId === '000000000000').template.createTemplateBody()) as ICfnTemplate;
    });

    it('can create cfn bindings for template', () => {
        expect(bindings).to.not.be.undefined;
    });

    it('creates template for master account', () => {
        expect(masterAccountTemplate).to.not.be.undefined;
        const resource = masterAccountTemplate.Resources.Resource;
        expect(resource).to.not.be.empty;
    });

    it('enum target for all accounts creates array with value for all accounts', () => {
        const resource = masterAccountTemplate.Resources.Resource;
        const val = resource.Properties.EnumAllTargetAccounts;
        expect(Array.isArray(val)).to.be.true;
        expect(val.length).to.eq(4);
        expect(val[0]).to.eq('blabla-111111111111-blabla');
        expect(val[3]).to.eq('blabla-444444444444-blabla');
    });

    it('enum target for OU1 creates string value for only 1', () => {
        const resource = masterAccountTemplate.Resources.Resource;
        const val = resource.Properties.EnumOU1TargetAccounts;
        expect(Array.isArray(val)).to.be.false;
        expect(val).to.eq('blabla-111111111111-blabla');
    });

    it('enum regions for all creates array with value for each region', () => {
        const resource = masterAccountTemplate.Resources.Resource;
        const val = resource.Properties.EnumAllTargetRegions;
        expect(Array.isArray(val)).to.be.true;
        expect(val.length).to.eq(2);
        expect(val[0]).to.eq('blabla-eu-west-1-blabla');
        expect(val[1]).to.eq('blabla-eu-central-1-blabla');
    });

    it('enum regions for ou1 creates string value for each region', () => {
        const resource = masterAccountTemplate.Resources.Resource;
        const val = resource.Properties.EnumOU1TargetRegions;
        expect(val).to.eq('blabla-eu-west-1-blabla');
    });

    it('enum accounts for results in Sub expression if variables are found', () => {
        const resource = masterAccountTemplate.Resources.Resource;
        const val: ICfnSubValue = resource.Properties.EnumWithOtherParameter;
        expect(val['Fn::Sub']).to.not.be.undefined;
        expect(val['Fn::Sub']).to.eq('blabla-111111111111-${something}-blabla');
    });

    it('enum accounts can be used without template', () => {
        const resource = masterAccountTemplate.Resources.Resource;
        const val = resource.Properties.EnumAllTargetAccountsWithoutExpression;
        expect(Array.isArray(val)).to.be.true;
        expect(val.length).to.eq(4);
        expect(val[0]).to.eq('111111111111');
        expect(val[3]).to.eq('444444444444');
    });

});
