import * as AWS from 'aws-sdk';
import * as AWSMock from 'aws-sdk-mock';
import { CreateAccountRequest, TagResourceRequest, UntagResourceRequest } from 'aws-sdk/clients/organizations';
import { expect } from 'chai';
import * as Sinon from 'sinon';
import { AwsOrganization } from '../../../src/aws-provider/aws-organization';
import { AwsOrganizationWriter } from '../../../src/aws-provider/aws-organization-writer';
import { ConsoleUtil } from '../../../src/console-util';
import { Resource } from '../../../src/parser/model/resource';
import { TestOrganizations } from '../test-organizations';
describe('when creating a new account using writer', () => {
    let organizationService: AWS.Organizations;
    let organizationModel: AwsOrganization;
    let writer: AwsOrganizationWriter;
    let createAccountSpy: Sinon.SinonSpy;
    let tagResourceSpy: Sinon.SinonSpy;
    let untagResourceSpy: Sinon.SinonSpy;
    const account = { rootEmail: 'new-email@org.com', accountName: 'Account Name', tags: {tag1: 'val1', tag2: 'val2'} };
    const accountId = '123456789011';

    beforeEach(async () => {
        AWSMock.setSDKInstance(AWS);

        AWSMock.mock('Organizations', 'createAccount', (params: any, callback: any) => { callback(null, {CreateAccountStatus: {State: 'SUCCEEDED', AccountId: accountId} }); });
        AWSMock.mock('Organizations', 'describeCreateAccountStatus', (params: any, callback: any) => { callback(null, {CreateAccountStatus: {State: 'SUCCEEDED', AccountId: accountId }}); });
        AWSMock.mock('Organizations', 'tagResource', (params: any, callback: any) => { callback(null, {}); });
        AWSMock.mock('Organizations', 'untagResource', (params: any, callback: any) => { callback(null, {}); });

        organizationService = new AWS.Organizations();
        organizationModel = TestOrganizations.createBasicOrganization();

        createAccountSpy = organizationService.createAccount as Sinon.SinonSpy;
        tagResourceSpy = organizationService.tagResource as Sinon.SinonSpy;
        untagResourceSpy = organizationService.untagResource as Sinon.SinonSpy;
        expect(createAccountSpy.callCount).to.eq(0);

        writer = new AwsOrganizationWriter(organizationService, organizationModel);
        await writer.createAccount(account as any);
    });

    afterEach(() => {
        AWSMock.restore();
    });

    it('organization create account is called', () => {
        expect(createAccountSpy.callCount).to.eq(1);
    });

    it('organization create account was passed the right arguments', () => {
        const args: CreateAccountRequest = createAccountSpy.lastCall.args[0];
        expect(args.AccountName).to.eq(account.accountName);
        expect(args.Email).to.eq(account.rootEmail);
    });

    it('organization tag account is called once', () => {
        expect(tagResourceSpy.callCount).to.eq(1);
    });

    it('organization tag account was passed the right arguments', () => {
        const args: TagResourceRequest = tagResourceSpy.lastCall.args[0];
        expect(args.ResourceId).to.eq(accountId);
        expect(args.Tags[0].Key).to.eq('tag1');
        expect(args.Tags[0].Value).to.eq('val1');
        expect(args.Tags[1].Key).to.eq('tag2');
        expect(args.Tags[1].Value).to.eq('val2');
    });

    it('organization un-tag account is not called', () => {
        expect(untagResourceSpy.callCount).to.eq(0);
    });

    it('account is added to organization model', () => {
        const accountFromModel = organizationModel.accounts.find((x) => x.Email === account.rootEmail);
        expect(accountFromModel).to.not.be.undefined;
        expect(accountFromModel.Email).to.eq(account.rootEmail);
        expect(accountFromModel.Name).to.eq(account.accountName);
        expect(accountFromModel.Id).to.eq(accountId);
    });
});

describe('when creating an account that already existed', () => {
    let organizationService: AWS.Organizations;
    let organizationModel: AwsOrganization;
    let writer: AwsOrganizationWriter;
    let createAccountSpy: Sinon.SinonSpy;
    let tagResourceSpy: Sinon.SinonSpy;
    let untagResourceSpy: Sinon.SinonSpy;
    const accountId = '123456789012';
    const account = { accountId, accountName: 'Account Name', tags: {tag1: 'val1', tag2: 'val2'} };

    beforeEach(async () => {
        AWSMock.mock('Organizations', 'createAccount', (params: any, callback: any) => { callback(null, {CreateAccountStatus: {State: 'SUCCEEDED', AccountId: accountId} }); });
        AWSMock.mock('Organizations', 'describeCreateAccountStatus', (params: any, callback: any) => { callback(null, {CreateAccountStatus: {State: 'SUCCEEDED', AccountId: accountId }}); });
        AWSMock.mock('Organizations', 'tagResource', (params: any, callback: any) => { callback(null, {}); });
        AWSMock.mock('Organizations', 'untagResource', (params: any, callback: any) => { callback(null, {}); });

        organizationService = new AWS.Organizations();
        organizationModel = TestOrganizations.createBasicOrganization();

        createAccountSpy = organizationService.createAccount as Sinon.SinonSpy;
        tagResourceSpy = organizationService.tagResource as Sinon.SinonSpy;
        untagResourceSpy = organizationService.untagResource as Sinon.SinonSpy;

        writer = new AwsOrganizationWriter(organizationService, organizationModel);
        await writer.createAccount(account as any);
     } );

    afterEach(() => {
        AWSMock.restore();
    });

    it('organization create account is not called', () => {
        expect(createAccountSpy.callCount).to.eq(0);
    });

    it('organization tag account is called once', () => {
        expect(tagResourceSpy.callCount).to.eq(1);
    });

    it('organization tag account was passed the right arguments', () => {
        const args: TagResourceRequest = tagResourceSpy.lastCall.args[0];
        expect(args.ResourceId).to.eq(accountId);
        expect(args.Tags[0].Key).to.eq('tag2');
        expect(args.Tags[0].Value).to.eq('val2');
    });

    it('organization un-tag account is not called', () => {
        expect(untagResourceSpy.callCount).to.eq(0);
    });

    it('account is updated organization model', () => {
        expect(organizationModel.accounts.length).to.eq(1);
        const accountFromModel = organizationModel.accounts[0];
        expect(accountFromModel.Tags.tag2).to.eq('val2');
    });
});

describe('when updating account', () => {
    let organizationService: AWS.Organizations;
    let organizationModel: AwsOrganization;
    let writer: AwsOrganizationWriter;
    const sandbox = Sinon.createSandbox();
    let tagResourceSpy: Sinon.SinonSpy;
    let untagResourceSpy: Sinon.SinonSpy;
    let logWarningSpy: Sinon.SinonSpy;
    const accountId = '123456789012';
    const account = { accountId, accountName: 'Account Name 2', tags: {tag3: 'val3'} };

    beforeEach(async () => {
        AWSMock.mock('Organizations', 'createAccount', (params: any, callback: any) => { callback(null, {CreateAccountStatus: {State: 'SUCCEEDED', AccountId: accountId} }); });
        AWSMock.mock('Organizations', 'describeCreateAccountStatus', (params: any, callback: any) => { callback(null, {CreateAccountStatus: {State: 'SUCCEEDED', AccountId: accountId }}); });
        AWSMock.mock('Organizations', 'tagResource', (params: any, callback: any) => { callback(null, {}); });
        AWSMock.mock('Organizations', 'untagResource', (params: any, callback: any) => { callback(null, {}); });

        organizationService = new AWS.Organizations();
        organizationModel = TestOrganizations.createBasicOrganization();

        tagResourceSpy = organizationService.tagResource as Sinon.SinonSpy;
        untagResourceSpy = organizationService.untagResource as Sinon.SinonSpy;

        logWarningSpy = sandbox.spy(ConsoleUtil, 'LogWarning');

        writer = new AwsOrganizationWriter(organizationService, organizationModel);
        await writer.updateAccount(account as any, accountId);
     } );

    afterEach(() => {
        AWSMock.restore();
        sandbox.restore();
     });

    it('account name is not updated, warning is logged instead', () => {
        const accountInModel = organizationModel.accounts.find((x) => x.Id === accountId);
        expect(accountInModel).to.not.eq(account.accountName);
        expect(logWarningSpy.callCount).to.eq(1);
        const message = logWarningSpy.lastCall.args[0];
        expect(message).to.contain(account.accountName);
        expect(message).to.contain(account.accountId);
        expect(message).to.contain('cannot be changed');
    });

    it('new tags are added', () => {
        expect(tagResourceSpy.callCount).to.eq(1);
        const args: TagResourceRequest = tagResourceSpy.lastCall.args[0];
        expect(args.ResourceId).to.eq(accountId);
        expect(args.Tags[0].Key).to.eq('tag3');
        expect(args.Tags[0].Value).to.eq('val3');
    });

    it('old tags are removed', () => {
        expect(untagResourceSpy.callCount).to.eq(1);
        const args: UntagResourceRequest = untagResourceSpy.lastCall.args[0];
        expect(args.ResourceId).to.eq(accountId);
        expect(args.TagKeys[0]).to.eq('tag1');
    });

    it('organization model is updated', () => {
        const accountInModel = organizationModel.accounts.find((x) => x.Id === accountId);
        expect(accountInModel).to.not.be.undefined;
        expect(accountInModel.Tags).to.not.be.undefined;
        expect(accountInModel.Tags.tag3).to.eq('val3');

    });
});
