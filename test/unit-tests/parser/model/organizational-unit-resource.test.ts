
import { expect } from 'chai';
import * as chai from 'chai';
import { IOrganizationalUnitProperties, OrganizationalUnitResource } from '../../../../src/parser/model/organizational-unit-resource';
import { OrgResourceTypes } from '../../../../src/parser/model/resource-types';
import { IResource, TemplateRoot } from '../../../../src/parser/parser';

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

    it('copies properties from resource', () => {
        const ou = new OrganizationalUnitResource(template, 'logical-id', resource);
        expect(ou.organizationalUnitName).to.eq(properties.OrganizationalUnitName);
        expect(ou.tags).to.be.undefined;
    });

    it('copies tags from resource', () => {
        properties.Tags = { key1: 'val1', key2: 'val2' };
        const ou = new OrganizationalUnitResource(template, 'logical-id', resource);
        expect(ou.tags.key1).to.eq(properties.Tags.key1);
        expect(ou.tags.key2).to.eq(properties.Tags.key2);
    });

    it('throws an error if properties are missing', () => {
        resource.Properties = undefined;
        expect(() => { new OrganizationalUnitResource(template, 'logical-id', resource); }).to.throw(/logical-id/);
        expect(() => { new OrganizationalUnitResource(template, 'logical-id', resource); }).to.throw(/Properties/);
    });

    it('throws an error if organizational unit name is missing', () => {
        delete properties.OrganizationalUnitName;
        expect(() => { new OrganizationalUnitResource(template, 'logical-id', resource); }).to.throw(/logical-id/);
        expect(() => { new OrganizationalUnitResource(template, 'logical-id', resource); }).to.throw(/OrganizationalUnitName/);
    });
});
