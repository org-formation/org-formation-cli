import { expect } from 'chai';
import { IAccountProperties } from '../../../../src/parser/model/account-resource';
import { MasterAccountResource } from '../../../../src/parser/model/master-account-resource';
import { OrgResourceTypes } from '../../../../src/parser/model/resource-types';
import { IResource, TemplateRoot } from '../../../../src/parser/parser';

describe('when creating master account resource', () => {
    let template: TemplateRoot;
    let resource: IResource;
    let accountProperties: IAccountProperties;

    beforeEach(() => {
        template = TemplateRoot.create('./test/resources/valid-basic.yml');

        accountProperties = {
            RootEmail: 'email@email.com',
            AccountId: '123123123123',
            AccountName: 'Account name',
        };
        resource = {
            Type : OrgResourceTypes.MasterAccount,
            Properties: accountProperties,
        };
    });

    it('copies properties from resource', () => {
        const account = new MasterAccountResource(template, 'logical-id', resource);
        expect(account.accountName).to.eq(accountProperties.AccountName);
        expect(account.accountId).to.eq(accountProperties.AccountId);
        expect(account.rootEmail).to.eq(accountProperties.RootEmail);
        expect(account.tags).to.be.undefined;
    });

    it('copies tags from resource', () => {
        accountProperties.Tags = { key1: 'val1', key2: 'val2' };
        const account = new MasterAccountResource(template, 'logical-id', resource);
        expect(account.tags.key1).to.eq(accountProperties.Tags.key1);
        expect(account.tags.key2).to.eq(accountProperties.Tags.key2);
    });

    it('throws an error if properties are missing', () => {
        resource.Properties = undefined;
        expect(() => { new MasterAccountResource(template, 'logical-id', resource); }).to.throw(/logical-id/);
        expect(() => { new MasterAccountResource(template, 'logical-id', resource); }).to.throw(/Properties/);
    });

    it('throws an error if both rootEmail and accountId are missing', () => {
        delete accountProperties.AccountId;
        delete accountProperties.RootEmail;
        expect(() => { new MasterAccountResource(template, 'logical-id', resource); }).to.throw(/logical-id/);
        expect(() => { new MasterAccountResource(template, 'logical-id', resource); }).to.throw(/AccountId/);
        expect(() => { new MasterAccountResource(template, 'logical-id', resource); }).to.throw(/RootEmail/);
    });

    it('throws an error if accountName is missing', () => {
        delete accountProperties.AccountName;
        expect(() => { new MasterAccountResource(template, 'logical-id', resource); }).to.throw(/logical-id/);
        expect(() => { new MasterAccountResource(template, 'logical-id', resource); }).to.throw(/AccountName/);
    });
});
