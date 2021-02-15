import { IOrganizationRootProperties, OrganizationRootResource } from '~parser/model/organization-root-resource';
import { OrgResourceTypes } from '~parser/model/resource-types';
import { IResource, TemplateRoot } from '~parser/parser';

describe('when organization root resource', () => {
    let template: TemplateRoot;
    let resource: IResource;
    let properties: IOrganizationRootProperties;

    beforeEach(async() => {
        template = await TemplateRoot.create('./test/resources/valid-basic.yml');

        properties = {
            ServiceControlPolicies: '*',
        };
        resource = {
            Type : OrgResourceTypes.OrganizationRoot,
            Properties: properties,
        };
    });

    test('copies properties from resource', () => {
        const root = new OrganizationRootResource(template, 'logical-id', resource);
        expect((root as any).props.ServiceControlPolicies).toBe('*');
    });

    test('does not throw wnen properties are missing', () => {
        resource.Properties = undefined;
        new OrganizationRootResource(template, 'logical-id', resource);
    });

    test('hash is stable (and must be the same over versions)', () => {
        const instance = new OrganizationRootResource(template, 'logical-id', resource);
        expect(instance.calculateHash()).toBe('f99f3cff11045a38a95d0d1a3a557b99');
    });
});
