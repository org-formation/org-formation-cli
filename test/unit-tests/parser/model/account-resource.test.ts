import { AccountResource, IAccountProperties } from '../../../../src/parser/model/account-resource';
import { OrgResourceTypes } from '../../../../src/parser/model/resource-types';
import { IResource, TemplateRoot } from '../../../../src/parser/parser';

describe('when creating account resource', () => {
    let template: TemplateRoot;
    let resource: IResource;
    let accountProperties: IAccountProperties;

    beforeEach(() => {
        template = TemplateRoot.create('./test/resources/valid-basic.yml');

        accountProperties = {
            RootEmail: 'email@email.com',
            AccountId: '123123123123',
            AccountName: 'Account name',
            Alias: 'account-alias',
        };
        resource = {
            Type : OrgResourceTypes.Account,
            Properties: accountProperties,
        };
    });

    test('copies properties from resource', () => {
        const account = new AccountResource(template, 'logical-id', resource);
        expect(account.accountName).toBe(accountProperties.AccountName);
        expect(account.accountId).toBe(accountProperties.AccountId);
        expect(account.rootEmail).toBe(accountProperties.RootEmail);
        expect(account.alias).toBe(accountProperties.Alias);
        expect(account.tags).toBeUndefined();
    });

    test('copies tags from resource', () => {
        accountProperties.Tags = { key1: 'val1', key2: 'val2' };
        const account = new AccountResource(template, 'logical-id', resource);
        expect(account.tags.key1).toBe(accountProperties.Tags.key1);
        expect(account.tags.key2).toBe(accountProperties.Tags.key2);
    });

    test('throws an error if properties are missing', () => {
        resource.Properties = undefined;
        expect(() => { new AccountResource(template, 'logical-id', resource); }).toThrowError(/logical-id/);
        expect(() => { new AccountResource(template, 'logical-id', resource); }).toThrowError(/Properties/);
    });

    test('throws an error if both rootEmail and accountId are missing', () => {
        delete accountProperties.AccountId;
        delete accountProperties.RootEmail;
        expect(() => { new AccountResource(template, 'logical-id', resource); }).toThrowError(/logical-id/);
        expect(() => { new AccountResource(template, 'logical-id', resource); }).toThrowError(/AccountId/);
        expect(() => { new AccountResource(template, 'logical-id', resource); }).toThrowError(/RootEmail/);
    });

    test('throws an error if accountName is missing', () => {
        delete accountProperties.AccountName;
        expect(() => { new AccountResource(template, 'logical-id', resource); }).toThrowError(/logical-id/);
        expect(() => { new AccountResource(template, 'logical-id', resource); }).toThrowError(/AccountName/);
    });

    test('throws an error if accountId is not a 12 digit string', () => {
        accountProperties.AccountId = 'aaaaaaaaaaaa';
        expect(() => { new AccountResource(template, 'logical-id', resource); }).toThrowError(/logical-id/);
        expect(() => { new AccountResource(template, 'logical-id', resource); }).toThrowError(/AccountId/);
    });

    test('converts accountId to string if digit', () => {
        (accountProperties as any).AccountId = 111111111111;
        const account = new AccountResource(template, 'logical-id', resource);
        expect(typeof account.accountId).toBe('string');
    });

    test('hash is stable (and must be the same over versions)', () => {
        const account = new AccountResource(template, 'logical-id', resource);
        expect(account.calculateHash()).toBe('60f60a1b51a156dd809bec598d1eac8a');
    });

});
