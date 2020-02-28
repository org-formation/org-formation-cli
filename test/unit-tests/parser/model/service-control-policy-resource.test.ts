
import { OrgResourceTypes } from '~parser/model/resource-types';
import { IServiceControlPolicyProperties, ServiceControlPolicyResource } from '~parser/model/service-control-policy-resource';
import { IResource, TemplateRoot } from '~parser/parser';

describe('when creating service control policy resource', () => {
    let template: TemplateRoot;
    let resource: IResource;
    let properties: IServiceControlPolicyProperties;

    beforeEach(() => {
        template = TemplateRoot.create('./test/resources/valid-basic.yml');

        properties = {
            PolicyName: 'policy1',
            PolicyDocument: {
                Version: new Date('2012-10-17'),
                Statement: [],
            },
        };
        resource = {
            Type : OrgResourceTypes.ServiceControlPolicy,
            Properties: properties,
        };
    });

    test('copies properties from resource', () => {
        const scp = new ServiceControlPolicyResource(template, 'logical-id', resource);
        expect(scp.policyName).toBe(properties.PolicyName);
        expect(scp.policyDocument).toBe(properties.PolicyDocument);
        expect(scp.description).toBe(properties.Description);
    });

    test('policy version attribute is converted to string', () => {
        const scp = new ServiceControlPolicyResource(template, 'logical-id', resource);
        expect(scp.policyDocument.Version).toBe('2012-10-17');
    });

    test('throws an error if properties are missing', () => {
        resource.Properties = undefined;
        expect(() => { new ServiceControlPolicyResource(template, 'logical-id', resource); }).toThrowError(/logical-id/);
        expect(() => { new ServiceControlPolicyResource(template, 'logical-id', resource); }).toThrowError(/Properties/);
    });

    test('throws an error if policy name is missing', () => {
        delete properties.PolicyName;
        expect(() => { new ServiceControlPolicyResource(template, 'logical-id', resource); }).toThrowError(/logical-id/);
        expect(() => { new ServiceControlPolicyResource(template, 'logical-id', resource); }).toThrowError(/PolicyName/);
    });

    test('throws an error if policy document is missing', () => {
        delete properties.PolicyDocument;
        expect(() => { new ServiceControlPolicyResource(template, 'logical-id', resource); }).toThrowError(/logical-id/);
        expect(() => { new ServiceControlPolicyResource(template, 'logical-id', resource); }).toThrowError(/PolicyDocument/);
    });
    test('hash is stable (and must be the same over versions)', () => {
        const instance = new ServiceControlPolicyResource(template, 'logical-id', resource);
        expect(instance.calculateHash()).toBe('fc4164062320f0c281888cdb1649d6d8');
    });
});
