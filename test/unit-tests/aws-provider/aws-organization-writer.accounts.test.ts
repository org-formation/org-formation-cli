import * as AWS from 'aws-sdk';
import * as AWSMock from 'aws-sdk-mock';
import { CreateAccountRequest, TagResourceRequest, UntagResourceRequest } from 'aws-sdk/clients/organizations';
import * as Sinon from 'sinon';
import { AwsEvents } from '../../../src/aws-provider/aws-events';
import { AwsOrganization } from '../../../src/aws-provider/aws-organization';
import { AwsOrganizationWriter } from '../../../src/aws-provider/aws-organization-writer';
import { ConsoleUtil } from '../../../src/console-util';
import { TestOrganizations } from '../test-organizations';

describe('when creating a new account using writer', () => {
    let organizationService: AWS.Organizations;
    let organizationModel: AwsOrganization;
    let writer: AwsOrganizationWriter;
    let createAccountSpy: Sinon.SinonSpy;
    let tagResourceSpy: Sinon.SinonSpy;
    let untagResourceSpy: Sinon.SinonSpy;
    let putAccountCreatedEventSpy: Sinon.SinonSpy;
    const sanbox = Sinon.createSandbox();

    const account = { rootEmail: 'new-email@org.com', accountName: 'Account Name', tags: {tag1: 'val1', tag2: 'val2'} };
    const accountId = '123456789011';

    beforeEach(async () => {
        AWSMock.setSDKInstance(AWS);

        AWSMock.mock('Organizations', 'createAccount', (params: any, callback: any) => { callback(null, {CreateAccountStatus: {State: 'SUCCEEDED', AccountId: accountId} }); });
        AWSMock.mock('Organizations', 'describeCreateAccountStatus', (params: any, callback: any) => { callback(null, {CreateAccountStatus: {State: 'SUCCEEDED', AccountId: accountId }}); });
        AWSMock.mock('Organizations', 'tagResource', (params: any, callback: any) => { callback(null, {}); });
        AWSMock.mock('Organizations', 'untagResource', (params: any, callback: any) => { callback(null, {}); });
        putAccountCreatedEventSpy = sanbox.stub(AwsEvents, 'putAccountCreatedEvent');

        organizationService = new AWS.Organizations();
        organizationModel = TestOrganizations.createBasicOrganization();

        createAccountSpy = organizationService.createAccount as Sinon.SinonSpy;
        tagResourceSpy = organizationService.tagResource as Sinon.SinonSpy;
        untagResourceSpy = organizationService.untagResource as Sinon.SinonSpy;
        expect(createAccountSpy.callCount).toBe(0);

        writer = new AwsOrganizationWriter(organizationService, organizationModel);
        await writer.createAccount(account as any);
    });

    afterEach(() => {
        AWSMock.restore();
        sanbox.restore();
    });

    test('organization create account is called', () => {
        expect(createAccountSpy.callCount).toBe(1);
    });

    test('organization create account was passed the right arguments', () => {
        const args: CreateAccountRequest = createAccountSpy.lastCall.args[0];
        expect(args.AccountName).toBe(account.accountName);
        expect(args.Email).toBe(account.rootEmail);
    });

    test('organization tag account is called once', () => {
        expect(tagResourceSpy.callCount).toBe(1);
    });

    test('organization tag account was passed the right arguments', () => {
        const args: TagResourceRequest = tagResourceSpy.lastCall.args[0];
        expect(args.ResourceId).toBe(accountId);
        expect(args.Tags[0].Key).toBe('tag1');
        expect(args.Tags[0].Value).toBe('val1');
        expect(args.Tags[1].Key).toBe('tag2');
        expect(args.Tags[1].Value).toBe('val2');
    });

    test('organization un-tag account is not called', () => {
        expect(untagResourceSpy.callCount).toBe(0);
    });

    test('account is added to organization model', () => {
        const accountFromModel = organizationModel.accounts.find((x) => x.Email === account.rootEmail);
        expect(accountFromModel).toBeDefined();
        expect(accountFromModel.Email).toBe(account.rootEmail);
        expect(accountFromModel.Name).toBe(account.accountName);
        expect(accountFromModel.Id).toBe(accountId);
    });

    test('event has been published for new account', () => {
        expect(putAccountCreatedEventSpy.callCount).toBe(1);
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
     });

    afterEach(() => {
        AWSMock.restore();
    });

    test('organization create account is not called', () => {
        expect(createAccountSpy.callCount).toBe(0);
    });

    test('organization tag account is called once', () => {
        expect(tagResourceSpy.callCount).toBe(1);
    });

    test('organization tag account was passed the right arguments', () => {
        const args: TagResourceRequest = tagResourceSpy.lastCall.args[0];
        expect(args.ResourceId).toBe(accountId);
        expect(args.Tags[0].Key).toBe('tag2');
        expect(args.Tags[0].Value).toBe('val2');
    });

    test('organization un-tag account is not called', () => {
        expect(untagResourceSpy.callCount).toBe(0);
    });

    test('account is updated organization model', () => {
        expect(organizationModel.accounts.length).toBe(1);
        const accountFromModel = organizationModel.accounts[0];
        expect(accountFromModel.Tags.tag2).toBe('val2');
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
     });

    afterEach(() => {
        AWSMock.restore();
        sandbox.restore();
     });

    test('account name is not updated, warning is logged instead', () => {
        const accountInModel = organizationModel.accounts.find((x) => x.Id === accountId);
        expect(accountInModel).not.toBe(account.accountName);
        expect(logWarningSpy.callCount).toBe(1);
        const message = logWarningSpy.lastCall.args[0];
        expect(message).toEqual(expect.stringContaining(account.accountName));
        expect(message).toEqual(expect.stringContaining(account.accountId));
        expect(message).toEqual(expect.stringContaining('cannot be changed'));
    });

    test('new tags are added', () => {
        expect(tagResourceSpy.callCount).toBe(1);
        const args: TagResourceRequest = tagResourceSpy.lastCall.args[0];
        expect(args.ResourceId).toBe(accountId);
        expect(args.Tags[0].Key).toBe('tag3');
        expect(args.Tags[0].Value).toBe('val3');
    });

    test('old tags are removed', () => {
        expect(untagResourceSpy.callCount).toBe(1);
        const args: UntagResourceRequest = untagResourceSpy.lastCall.args[0];
        expect(args.ResourceId).toBe(accountId);
        expect(args.TagKeys[0]).toBe('tag1');
    });

    test('organization model is updated', () => {
        const accountInModel = organizationModel.accounts.find((x) => x.Id === accountId);
        expect(accountInModel).toBeDefined();
        expect(accountInModel.Tags).toBeDefined();
        expect(accountInModel.Tags.tag3).toBe('val3');

    });
});
