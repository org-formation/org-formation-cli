import { OrganizationRootResource } from '~parser/model/organization-root-resource';
import { OrgResourceTypes } from '~parser/model/resource-types';
import { IResource, TemplateRoot } from '~parser/parser';
import { IPasswordPolicyProperties, PasswordPolicyResource } from '~parser/model/password-policy-resource';

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

    test('throws for mininum password length too small', () => {
        properties.MinimumPasswordLength = 3
        expect(() => { new PasswordPolicyResource(template, 'logical-id', resource); }).toThrowError(/MinimumPasswordLength/)
        expect(() => { new PasswordPolicyResource(template, 'logical-id', resource); }).toThrowError(/greater than or equal to 6/)
    });

    test('throws for mininum password length too large', () => {
        properties.MinimumPasswordLength = 129
        expect(() => { new PasswordPolicyResource(template, 'logical-id', resource); }).toThrowError(/MinimumPasswordLength/)
        expect(() => { new PasswordPolicyResource(template, 'logical-id', resource); }).toThrowError(/smaller than or equal to 128/)
    });

    test('throws for password reuse prevention too small', () => {
        properties.PasswordReusePrevention = 0
        expect(() => { new PasswordPolicyResource(template, 'logical-id', resource); }).toThrowError(/PasswordReusePrevention/)
        expect(() => { new PasswordPolicyResource(template, 'logical-id', resource); }).toThrowError(/greater than or equal to 1/)
    });

    test('throws for password reuse prevention too large', () => {
        properties.PasswordReusePrevention = 50
        expect(() => { new PasswordPolicyResource(template, 'logical-id', resource); }).toThrowError(/PasswordReusePrevention/)
        expect(() => { new PasswordPolicyResource(template, 'logical-id', resource); }).toThrowError(/smaller than or equal to 24/)
    });

    test('throws for max password age too small', () => {
        properties.MaxPasswordAge = 0
        expect(() => { new PasswordPolicyResource(template, 'logical-id', resource); }).toThrowError(/MaxPasswordAge/)
        expect(() => { new PasswordPolicyResource(template, 'logical-id', resource); }).toThrowError(/greater than or equal to 1/)
    });

});