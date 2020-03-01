
import { IOrganizationalUnitProperties, OrganizationalUnitResource } from '~parser/model/organizational-unit-resource';
import { OrgResourceTypes } from '~parser/model/resource-types';
import { IResource, TemplateRoot } from '~parser/parser';

describe('when creating organizational unit resource', () => {
    let template: TemplateRoot;
    let resource: IResource;
    let properties: IOrganizationalUnitProperties;

    beforeEach(() => {
        template = TemplateRoot.create('./test/resources/valid-basic.yml');

        properties = {
            OrganizationalUnitName: 'ou1',
        };
        resource = {
            Type : OrgResourceTypes.OrganizationalUnit,
            Properties: properties,
        };
    });

    test('copies properties from resource', () => {
        const ou = new OrganizationalUnitResource(template, 'logical-id', resource);
        expect(ou.organizationalUnitName).toBe(properties.OrganizationalUnitName);
    });

    test('throws an error if properties are missing', () => {
        resource.Properties = undefined;
        expect(() => { new OrganizationalUnitResource(template, 'logical-id', resource); }).toThrowError(/logical-id/);
        expect(() => { new OrganizationalUnitResource(template, 'logical-id', resource); }).toThrowError(/Properties/);
    });

    test('throws an error if organizational unit name is missing', () => {
        delete properties.OrganizationalUnitName;
        expect(() => { new OrganizationalUnitResource(template, 'logical-id', resource); }).toThrowError(/logical-id/);
        expect(() => { new OrganizationalUnitResource(template, 'logical-id', resource); }).toThrowError(/OrganizationalUnitName/);
    });

    test('hash is stable (and must be the same over versions)', () => {
        const instance = new OrganizationalUnitResource(template, 'logical-id', resource);
        expect(instance.calculateHash()).toBe('26f3bfb7ba4278ff73d8f937db5a07ab');
    });
});
