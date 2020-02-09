import { CloudFormationBinder, ICfnBinding } from '../../../src/cfn-binder/cfn-binder';
import { OrgResourceTypes } from '../../../src/parser/model/resource-types';
import { PersistedState } from '../../../src/state/persisted-state';
import { TestTemplates } from '../test-templates';


describe('when enumerating bindings on template resource with multiple accounts', () => {
    let binder: CloudFormationBinder;
    let bindings: ICfnBinding[];

    beforeEach(() => {
        const templateRoot = TestTemplates.createBasicTemplate( {
            resource:  {
                Type: 'AWS::Custom',
                Properties: {
                    Whatever: 'Value',
                },
                OrganizationBinding: {
                    Region: 'eu-central-1',
                    Account: [
                        {Ref: 'Account'},
                        {Ref: 'Account2'},
                    ],
                },
            },
        });

        const state = PersistedState.CreateEmpty(templateRoot.organizationSection.masterAccount.accountId);
        state.setBinding({logicalId: 'Account', physicalId: '123123123123', type: OrgResourceTypes.Account, lastCommittedHash: 'asd'});
        state.setBinding({logicalId: 'Account2', physicalId: '123123123124', type: OrgResourceTypes.Account, lastCommittedHash: 'asd'});

        binder =  new CloudFormationBinder('test-stack', templateRoot, state);
        bindings = binder.enumBindings();
    });

    test('creates a binding for every target account', () => {
        expect(bindings).toBeDefined();
        expect(bindings.length).toBe(2);
        expect(bindings.find((x) => x.region === 'eu-central-1' &&  x.accountId === '123123123123')).toBeDefined();
        expect(bindings.find((x) => x.region === 'eu-central-1' && x.accountId === '123123123124')).toBeDefined();
    });
});

describe('when enumerating bindings on template resource with multiple regions', () => {
    let binder: CloudFormationBinder;
    let bindings: ICfnBinding[];

    beforeEach(() => {
        const templateRoot = TestTemplates.createBasicTemplate( {
            resource:  {
                Type: 'AWS::Custom',
                Properties: {
                    Whatever: 'Value',
                },
                OrganizationBinding: {
                    Region: ['eu-west-1', 'eu-central-1'],
                    Account:  {Ref: 'Account'},
                },
            },
        });

        const state = PersistedState.CreateEmpty(templateRoot.organizationSection.masterAccount.accountId);
        state.setBinding({logicalId: 'Account', physicalId: '123123123123', type: OrgResourceTypes.Account, lastCommittedHash: 'asd'});

        binder =  new CloudFormationBinder('test-stack', templateRoot, state);
        bindings = binder.enumBindings();
    });

    test('creates a binding for every target region', () => {
        expect(bindings).toBeDefined();
        expect(bindings.length).toBe(2);
        expect(bindings.find((x) => x.region === 'eu-central-1' &&  x.accountId === '123123123123')).toBeDefined();
        expect(bindings.find((x) => x.region === 'eu-west-1' && x.accountId === '123123123123')).toBeDefined();
    });
});

describe('when enumerating bindings on template resource with cross account dependency', () => {
    let binder: CloudFormationBinder;
    let bindings: ICfnBinding[];

    beforeEach(() => {
        const templateRoot = TestTemplates.createBasicTemplate( {
            resource1:  {
                Type: 'AWS::Custom',
                Properties: {
                    Whatever: 'Value',
                },
                OrganizationBinding: {
                    Region: ['eu-central-1'],
                    Account:  {Ref: 'Account'},
                },
            },
            resource2:  {
                Type: 'AWS::Custom',
                Properties: {
                    propRef: {Ref: 'resource1' },
                    propAtt: {'Fn::GetAtt': 'resource1.Whatever' },
                },
                OrganizationBinding: {
                    Region: ['eu-west-1'],
                    Account:  {Ref: 'Account2'},
                },
            },
        });

        const state = PersistedState.CreateEmpty(templateRoot.organizationSection.masterAccount.accountId);
        state.setBinding({logicalId: 'Account', physicalId: '123123123123', type: OrgResourceTypes.Account, lastCommittedHash: 'asd'});
        state.setBinding({logicalId: 'Account2', physicalId: '123123123124', type: OrgResourceTypes.Account, lastCommittedHash: 'asd'});

        binder =  new CloudFormationBinder('test-stack', templateRoot, state);
        bindings = binder.enumBindings();
    });

    test('creates a binding for every target account/region', () => {
        expect(bindings).toBeDefined();
        expect(bindings.length).toBe(2);
        expect(bindings.find((x) => x.region === 'eu-central-1' &&  x.accountId === '123123123123')).toBeDefined();
        expect(bindings.find((x) => x.region === 'eu-west-1' && x.accountId === '123123123124')).toBeDefined();
    });

    test('creates dependency relationship', () => {
        const dependent = bindings.find((x) => x.region === 'eu-west-1' &&  x.accountId === '123123123124');
        const dependency = bindings.find((x) => x.region === 'eu-central-1' &&  x.accountId === '123123123123');

        expect(dependency.dependencies.length).toBe(0);
        expect(dependency.dependents.length).toBe(1);
        expect(dependency.dependents[0].parameterAccountId).toBe(dependent.accountId);

        expect(dependent.dependents.length).toBe(0);
        expect(dependent.dependencies.length).toBe(1);
        expect(dependent.dependencies[0].outputAccountId).toBe(dependency.accountId);
    });

    test('creates an output for the dependency template', () => {
        const dependency = bindings.find((x) => x.region === 'eu-central-1' &&  x.accountId === '123123123123');

        const templateObject = GetTemplate(dependency);

        expect(templateObject.Outputs.testDashstackDashresource1).toBeDefined();
        expect(templateObject.Outputs.testDashstackDashresource1.Value.Ref).toBeDefined();
        expect(templateObject.Outputs.testDashstackDashresource1.Value.Ref).toBe('resource1');
        expect(templateObject.Outputs.testDashstackDashresource1.Export.Name).toBeDefined();
    });

    test('creates a parameter for the dependent template', () => {
        const dependent = bindings.find((x) => x.region === 'eu-west-1' &&  x.accountId === '123123123124');

        const templateObject = GetTemplate(dependent);

        expect(templateObject.Parameters.resource1).toBeDefined();

    });

    test(
        'creates additional parameter attributes for the dependent template',
        () => {
            const dependent = bindings.find((x) => x.region === 'eu-west-1' &&  x.accountId === '123123123124');
            const dependency = bindings.find((x) => x.region === 'eu-central-1' &&  x.accountId === '123123123123');

            const dependentTemplateObject = GetTemplate(dependent);
            const dependencyTemplateObject = GetTemplate(dependency);

            expect(dependentTemplateObject.Parameters.resource1).toBeDefined();
            expect(dependentTemplateObject.Parameters.resource1.ExportName).toBe(dependencyTemplateObject.Outputs.testDashstackDashresource1.Export.Name);
            expect(dependentTemplateObject.Parameters.resource1.ExportRegion).toBe('eu-central-1');
            expect(dependentTemplateObject.Parameters.resource1.ExportAccountId).toBe('123123123123');
            expect(dependentTemplateObject.Parameters.resource1.Type).toBe('String');
        }
    );

    test('can enum bound parameters', () => {
        const dependent = bindings.find((x) => x.region === 'eu-west-1' &&  x.accountId === '123123123124');
        const dependentTemplateObject = GetTemplate(dependent);
        const boundParameters = dependent.template.enumBoundParameters();
        const keys = Object.keys(boundParameters);
        expect(keys.length).toBe(1);
        expect (boundParameters[keys[0]].ExportName).toBe(dependentTemplateObject.Parameters.resource1.ExportName);
    });
});

function GetTemplate(dependent: ICfnBinding) {
    expect(dependent).toBeDefined();
    expect(dependent.template).toBeDefined();
    const templateContents = dependent.template.createTemplateBody();
    const templateObject = JSON.parse(templateContents);
    return templateObject;
}
