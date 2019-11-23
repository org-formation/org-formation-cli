import { expect } from 'chai';
import { CloudFormationBinder, ICfnBinding } from '../../../src/cfn-binder/cfn-binder';
import { OrgResourceTypes } from '../../../src/parser/model/resource-types';
import { TemplateRoot } from '../../../src/parser/parser';
import { PersistedState } from '../../../src/state/persisted-state';
import { ICfnGetAttValue, ICfnJoinValue, ICfnRefValue, ICfnTemplate } from '../cfn-types';

describe('when loading hostedzone-per-account template', () => {
    let template: TemplateRoot;
    let cloudformationBinder: CloudFormationBinder;
    let bindings: ICfnBinding[];
    let masterBinding: ICfnBinding;
    let masterCfnTemplate: ICfnTemplate;
    let account1Binding: ICfnBinding;
    let account1CfnTemplate: ICfnTemplate;
    let account2Binding: ICfnBinding;
    let account2CfnTemplate: ICfnTemplate;

    beforeEach(() => {
        template = TemplateRoot.create('./test/resources/hostedzone-per-account/hostedzone-per-account.yml');
        const persistedState = PersistedState.CreateEmpty(template.organizationSection.masterAccount.accountId);

        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '0', logicalId: 'MasterAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '1', logicalId: 'Account1', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '2', logicalId: 'Account2', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '3', logicalId: 'Account3', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '4', logicalId: 'Account4', lastCommittedHash: 'abc'});

        cloudformationBinder = new CloudFormationBinder('foreach', template, persistedState);
        bindings = cloudformationBinder.enumBindings();
        masterBinding = bindings.find((x) => x.accountId === '0');
        masterCfnTemplate = JSON.parse(masterBinding.template.createTemplateBody()) as ICfnTemplate;
        account1Binding = bindings.find((x) => x.accountId === '1');
        account1CfnTemplate = JSON.parse(account1Binding.template.createTemplateBody()) as ICfnTemplate;
        account2Binding = bindings.find((x) => x.accountId === '2');
        account2CfnTemplate = JSON.parse(account2Binding.template.createTemplateBody()) as ICfnTemplate;
    });

    it('can create cfn bindings for template', () => {
        expect(bindings).to.not.be.undefined;
    });

    it('creates 3 bindings for template', () => {
        expect(bindings.length).to.eq(3);
    });

    it('master record has 2 recordsets resorces', () => {
        const resources = Object.entries(masterCfnTemplate.Resources).map((x) => x[1]);
        const recordSets = resources.filter((x) => x.Type === 'AWS::Route53::RecordSet');
        expect(recordSets.length).to.eq(2);
    });

    it('other accounts dont have recordsets resorces', () => {
        const resources1 = Object.entries(account1CfnTemplate.Resources).map((x) => x[1]);
        const recordSets1 = resources1.filter((x) => x.Type === 'AWS::Route53::RecordSet');
        expect(recordSets1.length).to.eq(0);

        const resources = Object.entries(account2CfnTemplate.Resources).map((x) => x[1]);
        const recordSets = resources.filter((x) => x.Type === 'AWS::Route53::RecordSet');
        expect(recordSets.length).to.eq(0);
    });

    it('account 1 has export on HostedZoneNameServers', () => {
        const outputs = Object.entries(account1CfnTemplate.Outputs).map((x) => x[1]);
        expect(outputs.length).to.eq(1);
        const output = outputs[0];
        expect(output.Value).to.not.be.undefined;
        const val = output.Value as ICfnJoinValue;
        expect(val['Fn::Join'][0]).to.eq(', ');
        expect(val['Fn::Join'][1]).to.not.be.undefined;
        const ValGetAtt = val['Fn::Join'][1] as ICfnGetAttValue;
        expect(ValGetAtt['Fn::GetAtt'][0]).to.eq('HostedZone');
        expect(ValGetAtt['Fn::GetAtt'][1]).to.eq('NameServers');

        expect(output.Export.Name).to.eq('foreach-Account1-ResourcesDotHostedZoneDotNameServers');
    });

    it('account 2 has export on HostedZoneNameServers', () => {
        const outputs = Object.entries(account2CfnTemplate.Outputs).map((x) => x[1]);
        expect(outputs.length).to.eq(1);
        const output = outputs[0];
        expect(output.Value).to.not.be.undefined;
        const val = output.Value as ICfnJoinValue;
        expect(val['Fn::Join'][0]).to.eq(', ');
        expect(val['Fn::Join'][1]).to.not.be.undefined;
        const ValGetAtt = val['Fn::Join'][1] as ICfnGetAttValue;
        expect(ValGetAtt['Fn::GetAtt'][0]).to.eq('HostedZone');
        expect(ValGetAtt['Fn::GetAtt'][1]).to.eq('NameServers');

        expect(output.Export.Name).to.eq('foreach-Account2-ResourcesDotHostedZoneDotNameServers');
    });

    it('master account imports HostedZoneNameServers from both other accounts', () => {
        const resourceForAccount1 = masterCfnTemplate.Resources.ParentNsRecordAccount1;
        const resourceForAccount2 = masterCfnTemplate.Resources.ParentNsRecordAccount2;

        expect(resourceForAccount1).to.not.be.undefined;
        expect(resourceForAccount2).to.not.be.undefined;

        const resourceRecordsAccount1 = resourceForAccount1.Properties.ResourceRecords as ICfnRefValue;
        expect(resourceRecordsAccount1.Ref).to.eq('Account1DotResourcesDotHostedZoneDotNameServers');
        const resourceRecordsAccount2 = resourceForAccount2.Properties.ResourceRecords as ICfnRefValue;
        expect(resourceRecordsAccount2.Ref).to.eq('Account2DotResourcesDotHostedZoneDotNameServers');

        const paramAccount1 = masterCfnTemplate.Parameters.Account1DotResourcesDotHostedZoneDotNameServers;
        expect(paramAccount1).to.not.be.undefined;
        expect(paramAccount1.ExportRegion).to.eq('eu-west-1');
        expect(paramAccount1.ExportAccountId).to.eq('1');
        expect(paramAccount1.ExportName).to.eq('foreach-Account1-ResourcesDotHostedZoneDotNameServers');

        const paramAccount2 = masterCfnTemplate.Parameters.Account2DotResourcesDotHostedZoneDotNameServers;
        expect(paramAccount2).to.not.be.undefined;
        expect(paramAccount2.ExportRegion).to.eq('eu-west-1');
        expect(paramAccount2.ExportAccountId).to.eq('2');
        expect(paramAccount2.ExportName).to.eq('foreach-Account2-ResourcesDotHostedZoneDotNameServers');
    });
});
