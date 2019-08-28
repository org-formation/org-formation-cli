import { expect } from 'chai';
import * as chai from 'chai';
import { AccountResource, IAccountProperties } from '../../../../src/parser/model/account-resource';
import { IOrganizationRootProperties, OrganizationRootResource } from '../../../../src/parser/model/organization-root-resource';
import { OrgResourceTypes } from '../../../../src/parser/model/resource-types';
import { IResource, TemplateRoot } from '../../../../src/parser/parser';

describe('when organization root resource', () => {
    let template: TemplateRoot;
    let resource: IResource;
    let properties: IOrganizationRootProperties;

    beforeEach(() => {
        template = TemplateRoot.create('./test/resources/valid-basic.yml');

        properties = {
            ServiceControlPolicies: '*',
        };
        resource = {
            Type : OrgResourceTypes.OrganizationRoot,
            Properties: properties,
        };
    });

    it('copies properties from resource', () => {
        const root = new OrganizationRootResource(template, 'logical-id', resource);
        expect((root as any).props.ServiceControlPolicies).to.eq('*');
    });

    it('throws an error if properties are missing', () => {
        resource.Properties = undefined;
        expect(() => { new OrganizationRootResource(template, 'logical-id', resource); }).to.throw(/logical-id/);
        expect(() => { new OrganizationRootResource(template, 'logical-id', resource); }).to.throw(/Properties/);
    });

});
