import { CloudFormationBinder, ICfnBinding } from '~cfn-binder/cfn-binder';
import { OrgResourceTypes } from '~parser/model/resource-types';
import { TemplateRoot } from '~parser/parser';
import { PersistedState } from '~state/persisted-state';
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

    beforeEach(async () => {
        template = TemplateRoot.create('./test/resources/hostedzone-per-account/hostedzone-per-account.yml');
        const persistedState = PersistedState.CreateEmpty(template.organizationSection.masterAccount.accountId);

        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '000000000000', logicalId: 'MasterAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '111111111111', logicalId: 'Account1', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '222222222222', logicalId: 'Account2', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '333333333333', logicalId: 'Account3', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '444444444444', logicalId: 'Account4', lastCommittedHash: 'abc'});

        cloudformationBinder = new CloudFormationBinder('hostedzone-per-account', template, persistedState);
        bindings = await cloudformationBinder.enumBindings();
        masterBinding = bindings.find((x) => x.accountId === '000000000000');
        masterCfnTemplate = JSON.parse(masterBinding.template.createTemplateBody()) as ICfnTemplate;
        account1Binding = bindings.find((x) => x.accountId === '111111111111');
        account1CfnTemplate = JSON.parse(account1Binding.template.createTemplateBody()) as ICfnTemplate;
        account2Binding = bindings.find((x) => x.accountId === '222222222222');
        account2CfnTemplate = JSON.parse(account2Binding.template.createTemplateBody()) as ICfnTemplate;
    });

    test('can create cfn bindings for template', () => {
        expect(bindings).toBeDefined();
    });

    test('creates 3 bindings for template', () => {
        expect(bindings.length).toBe(3);
    });

    test('master record has 2 recordsets resorces', () => {
        const resources = Object.entries(masterCfnTemplate.Resources).map((x) => x[1]);
        const recordSets = resources.filter((x) => x.Type === 'AWS::Route53::RecordSet');
        expect(recordSets.length).toBe(2);
    });

    test('other accounts dont have recordsets resorces', () => {
        const resources1 = Object.entries(account1CfnTemplate.Resources).map((x) => x[1]);
        const recordSets1 = resources1.filter((x) => x.Type === 'AWS::Route53::RecordSet');
        expect(recordSets1.length).toBe(0);

        const resources = Object.entries(account2CfnTemplate.Resources).map((x) => x[1]);
        const recordSets = resources.filter((x) => x.Type === 'AWS::Route53::RecordSet');
        expect(recordSets.length).toBe(0);
    });

    test('account 1 has export on HostedZoneNameServers', () => {
        const outputs = Object.entries(account1CfnTemplate.Outputs).map((x) => x[1]);
        expect(outputs.length).toBe(1);
        const output = outputs[0];
        expect(output.Value).toBeDefined();
        const val = output.Value as ICfnJoinValue;
        expect(val['Fn::Join'][0]).toBe(', ');
        expect(val['Fn::Join'][1]).toBeDefined();
        const ValGetAtt = val['Fn::Join'][1] as ICfnGetAttValue;
        expect(ValGetAtt['Fn::GetAtt'][0]).toBe('HostedZone');
        expect(ValGetAtt['Fn::GetAtt'][1]).toBe('NameServers');

        expect(output.Export.Name).toBe('hostedzone-per-account-HostedZone-NameServers');
    });

    test('account 2 has export on HostedZoneNameServers', () => {
        const outputs = Object.entries(account2CfnTemplate.Outputs).map((x) => x[1]);
        expect(outputs.length).toBe(1);
        const output = outputs[0];
        expect(output.Value).toBeDefined();
        const val = output.Value as ICfnJoinValue;
        expect(val['Fn::Join'][0]).toBe(', ');
        expect(val['Fn::Join'][1]).toBeDefined();
        const ValGetAtt = val['Fn::Join'][1] as ICfnGetAttValue;
        expect(ValGetAtt['Fn::GetAtt'][0]).toBe('HostedZone');
        expect(ValGetAtt['Fn::GetAtt'][1]).toBe('NameServers');

        expect(output.Export.Name).toBe('hostedzone-per-account-HostedZone-NameServers');
    });

    test(
        'master account imports HostedZoneNameServers from both other accounts',
        () => {
            const resourceForAccount1 = masterCfnTemplate.Resources.ParentNsRecord111111111111;
            const resourceForAccount2 = masterCfnTemplate.Resources.ParentNsRecord222222222222;

            expect(resourceForAccount1).toBeDefined();
            expect(resourceForAccount2).toBeDefined();

            const resourceRecordsAccount1 = resourceForAccount1.Properties.ResourceRecords as ICfnRefValue;
            expect(resourceRecordsAccount1.Ref).toBe('Account1DotResourcesDotHostedZoneDotNameServers');
            const resourceRecordsAccount2 = resourceForAccount2.Properties.ResourceRecords as ICfnRefValue;
            expect(resourceRecordsAccount2.Ref).toBe('Account2DotResourcesDotHostedZoneDotNameServers');

            const paramAccount1 = masterCfnTemplate.Parameters.Account1DotResourcesDotHostedZoneDotNameServers;
            expect(paramAccount1).toBeDefined();
            expect(paramAccount1.ExportRegion).toBe('eu-west-1');
            expect(paramAccount1.ExportAccountId).toBe('111111111111');
            expect(paramAccount1.ExportName).toBe('hostedzone-per-account-HostedZone-NameServers');

            const paramAccount2 = masterCfnTemplate.Parameters.Account2DotResourcesDotHostedZoneDotNameServers;
            expect(paramAccount2).toBeDefined();
            expect(paramAccount2.ExportRegion).toBe('eu-west-1');
            expect(paramAccount2.ExportAccountId).toBe('222222222222');
            expect(paramAccount2.ExportName).toBe('hostedzone-per-account-HostedZone-NameServers');
        }
    );
});
