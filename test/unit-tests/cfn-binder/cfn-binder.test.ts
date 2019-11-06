import * as chai from 'chai';
import { expect } from 'chai';
import { beforeEach } from 'mocha';
import { CloudFormationBinder, ICfnBinding } from '../../../src/cfn-binder/cfn-binder';
import { CfnTemplate } from '../../../src/cfn-binder/cfn-template';
import { AccountResource } from '../../../src/parser/model/account-resource';
import { CloudFormationResource } from '../../../src/parser/model/cloudformation-resource';
import { OrgResourceTypes } from '../../../src/parser/model/resource-types';
import { IResourceTarget, ResourcesSection } from '../../../src/parser/model/resources-section';
import { IResource, TemplateRoot } from '../../../src/parser/parser';
import { PersistedState } from '../../../src/state/persisted-state';
import { TestTemplates } from '../test-templates';

chai.use(require('chai-as-promised'));

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
                OrganizationBindings: {
                    Regions: 'eu-central-1',
                    Accounts: [
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

    it('creates a binding for every target account', () => {
        expect(bindings).to.not.be.undefined;
        expect(bindings.length).to.eq(2);
        expect(bindings.find((x) => x.region === 'eu-central-1' &&  x.accountId === '123123123123')).to.not.be.undefined;
        expect(bindings.find((x) => x.region === 'eu-central-1' && x.accountId === '123123123124')).to.not.be.undefined;
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
                OrganizationBindings: {
                    Regions: ['eu-west-1', 'eu-central-1'],
                    Accounts:  {Ref: 'Account'},
                },
            },
        });

        const state = PersistedState.CreateEmpty(templateRoot.organizationSection.masterAccount.accountId);
        state.setBinding({logicalId: 'Account', physicalId: '123123123123', type: OrgResourceTypes.Account, lastCommittedHash: 'asd'});

        binder =  new CloudFormationBinder('test-stack', templateRoot, state);
        bindings = binder.enumBindings();
    });

    it('creates a binding for every target region', () => {
        expect(bindings).to.not.be.undefined;
        expect(bindings.length).to.eq(2);
        expect(bindings.find((x) => x.region === 'eu-central-1' &&  x.accountId === '123123123123')).to.not.be.undefined;
        expect(bindings.find((x) => x.region === 'eu-west-1' && x.accountId === '123123123123')).to.not.be.undefined;
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
                OrganizationBindings: {
                    Regions: ['eu-central-1'],
                    Accounts:  {Ref: 'Account'},
                },
            },
            resource2:  {
                Type: 'AWS::Custom',
                Properties: {
                    propRef: {Ref: 'resource1' },
                    propAtt: {'Fn::GetAtt': 'resource1.Whatever' },
                },
                OrganizationBindings: {
                    Regions: ['eu-west-1'],
                    Accounts:  {Ref: 'Account2'},
                },
            },
        });

        const state = PersistedState.CreateEmpty(templateRoot.organizationSection.masterAccount.accountId);
        state.setBinding({logicalId: 'Account', physicalId: '123123123123', type: OrgResourceTypes.Account, lastCommittedHash: 'asd'});
        state.setBinding({logicalId: 'Account2', physicalId: '123123123124', type: OrgResourceTypes.Account, lastCommittedHash: 'asd'});

        binder =  new CloudFormationBinder('test-stack', templateRoot, state);
        bindings = binder.enumBindings();
    });

    it('creates a binding for every target account/region', () => {
        expect(bindings).to.not.be.undefined;
        expect(bindings.length).to.eq(2);
        expect(bindings.find((x) => x.region === 'eu-central-1' &&  x.accountId === '123123123123')).to.not.be.undefined;
        expect(bindings.find((x) => x.region === 'eu-west-1' && x.accountId === '123123123124')).to.not.be.undefined;
    });

    it('creates dependency relationship', () => {
        const dependent = bindings.find((x) => x.region === 'eu-west-1' &&  x.accountId === '123123123124');
        const dependency = bindings.find((x) => x.region === 'eu-central-1' &&  x.accountId === '123123123123');

        expect(dependency.dependencies.length).to.eq(0);
        expect(dependency.dependents.length).to.eq(1);
        expect(dependency.dependents[0].parameterAccountId).to.eq(dependent.accountId);

        expect(dependent.dependents.length).to.eq(0);
        expect(dependent.dependencies.length).to.eq(1);
        expect(dependent.dependencies[0].outputAccountId).to.eq(dependency.accountId);
    });

    it('creates an output for the dependency template', () => {
        const dependency = bindings.find((x) => x.region === 'eu-central-1' &&  x.accountId === '123123123123');

        const templateObject = GetTemplate(dependency);

        expect(templateObject.Outputs.testDashstackDashresource1).to.not.be.undefined;
        expect(templateObject.Outputs.testDashstackDashresource1.Value.Ref).to.not.be.undefined;
        expect(templateObject.Outputs.testDashstackDashresource1.Value.Ref).to.eq('resource1');
        expect(templateObject.Outputs.testDashstackDashresource1.Export.Name).to.not.be.undefined;
    });

    it('creates a parameter for the dependent template', () => {
        const dependent = bindings.find((x) => x.region === 'eu-west-1' &&  x.accountId === '123123123124');

        const templateObject = GetTemplate(dependent);

        expect(templateObject.Parameters.resource1).to.not.be.undefined;

    });

    it('creates additional parameter attributes for the dependent template', () => {
        const dependent = bindings.find((x) => x.region === 'eu-west-1' &&  x.accountId === '123123123124');
        const dependency = bindings.find((x) => x.region === 'eu-central-1' &&  x.accountId === '123123123123');

        const dependentTemplateObject = GetTemplate(dependent);
        const dependencyTemplateObject = GetTemplate(dependency);

        expect(dependentTemplateObject.Parameters.resource1).to.not.be.undefined;
        expect(dependentTemplateObject.Parameters.resource1.ExportName).to.eq(dependencyTemplateObject.Outputs.testDashstackDashresource1.Export.Name);
        expect(dependentTemplateObject.Parameters.resource1.ExportRegion).to.eq('eu-central-1');
        expect(dependentTemplateObject.Parameters.resource1.ExportAccountId).to.eq('123123123123');
        expect(dependentTemplateObject.Parameters.resource1.Type).to.eq('String');
    });

    it('can enum bound parameters', () => {
        const dependent = bindings.find((x) => x.region === 'eu-west-1' &&  x.accountId === '123123123124');
        const dependentTemplateObject = GetTemplate(dependent);
        const boundParameters = dependent.template.enumBoundParameters();
        expect(boundParameters.length).to.eq(1);
        expect (boundParameters[0].ExportName).to.eq(dependentTemplateObject.Parameters.resource1.ExportName);
    });
});

function GetTemplate(dependent: ICfnBinding) {
    expect(dependent).to.not.be.undefined;
    expect(dependent.template).to.not.be.undefined;
    const templateContents = dependent.template.createTemplateBody();
    const templateObject = JSON.parse(templateContents);
    return templateObject;
}
