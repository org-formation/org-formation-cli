import { OrganizationRootResource } from '../../../../src/parser/model/organization-root-resource';
import { OrgResourceTypes } from '../../../../src/parser/model/resource-types';
import { IResource, TemplateRoot } from '../../../../src/parser/parser';
import { IPasswordPolicyProperties, PasswordPolicyResource } from '../../../../src/parser/model/password-policy-resource';

describe('when password policy resource', () => {
    let template: TemplateRoot;
    let resource: IResource;
    let properties: IPasswordPolicyProperties;

    beforeEach(() => {
        template = TemplateRoot.create('./test/resources/valid-basic.yml');

        properties = {
            RequireLowercaseCharacters: true,
            RequireSymbols: true,
            RequireNumbers: true,
            RequireUppercaseCharacters: true,
            PasswordReusePrevention: 2,
            MinimumPasswordLength: 6,
            MaxPasswordAge: 10,
            AllowUsersToChangePassword: true
        };
        resource = {
            Type : OrgResourceTypes.OrganizationRoot,
            Properties: properties,
        };
    });

    test('copies properties from resource', () => {
        const pwdPolicy = new PasswordPolicyResource(template, 'logical-id', resource);
        expect(pwdPolicy.allowUsersToChangePassword).toBe(true);
        expect(pwdPolicy.requireSymbols).toBe(true);
        expect(pwdPolicy.requireNumbers).toBe(true);
        expect(pwdPolicy.requireLowercaseCharacters).toBe(true);
        expect(pwdPolicy.requireUppercaseCharacters).toBe(true);
        expect(pwdPolicy.minimumPasswordLength).toBe(6);
        expect(pwdPolicy.maxPasswordAge).toBe(10);
        expect(pwdPolicy.passwordReusePrevention).toBe(2);
    });
});