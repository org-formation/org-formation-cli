
import { expect } from 'chai';
import { OrgResourceTypes } from '../../../../src/parser/model/resource-types';
import { IServiceControlPolicyProperties, ServiceControlPolicyResource } from '../../../../src/parser/model/service-control-policy-resource';
import { IResource, TemplateRoot } from '../../../../src/parser/parser';

describe('when creating service control policy resource', () => {
    let template: TemplateRoot;
    let resource: IResource;
    let properties: IServiceControlPolicyProperties;

    beforeEach(() => {
        template = TemplateRoot.create('./test/resources/valid-basic.yml');

        properties = {
            PolicyName: 'policy1',
            PolicyDocument: {
                Version: new Date(2012, 10, 17),
                Statement: [],
            },
        };
        resource = {
            Type : OrgResourceTypes.ServiceControlPolicy,
            Properties: properties,
        };
    });

    it('copies properties from resource', () => {
        const scp = new ServiceControlPolicyResource(template, 'logical-id', resource);
        expect(scp.policyName).to.eq(properties.PolicyName);
        expect(scp.policyDocument).to.eq(properties.PolicyDocument);
        expect(scp.description).to.eq(properties.Description);
    });

    it('policy version attribute is converted to string', () => {
        const scp = new ServiceControlPolicyResource(template, 'logical-id', resource);
        expect(scp.policyDocument.Version).to.eq('2012-10-17');
    });

    it('throws an error if properties are missing', () => {
        resource.Properties = undefined;
        expect(() => { new ServiceControlPolicyResource(template, 'logical-id', resource); }).to.throw(/logical-id/);
        expect(() => { new ServiceControlPolicyResource(template, 'logical-id', resource); }).to.throw(/Properties/);
    });

    it('throws an error if policy name is missing', () => {
        delete properties.PolicyName;
        expect(() => { new ServiceControlPolicyResource(template, 'logical-id', resource); }).to.throw(/logical-id/);
        expect(() => { new ServiceControlPolicyResource(template, 'logical-id', resource); }).to.throw(/PolicyName/);
    });

    it('throws an error if policy document is missing', () => {
        delete properties.PolicyDocument;
        expect(() => { new ServiceControlPolicyResource(template, 'logical-id', resource); }).to.throw(/logical-id/);
        expect(() => { new ServiceControlPolicyResource(template, 'logical-id', resource); }).to.throw(/PolicyDocument/);
    });
});
