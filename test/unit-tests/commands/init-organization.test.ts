import { Command, Option } from 'commander';
const fs = require('fs');
import Sinon from 'sinon';
import { AwsUtil, DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS } from '~util/aws-util';
import { BaseCliCommand } from '~commands/base-command';
import { IInitCommandArgs, InitOrganizationCommand } from '~commands/init-organization';
import { IState, PersistedState } from '~state/persisted-state';
import { S3StorageProvider } from '~state/storage-provider';
import { DefaultTemplate } from '~writer/default-template-writer';
import { ConsoleUtil } from '~util/console-util';
import { GlobalState } from '~util/global-state';

describe('when creating init organization command', () => {
    let command: InitOrganizationCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;

    beforeEach(() => {
        commanderCommand = new Command('root');
        command = new InitOrganizationCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];
    });

    test('init command is created', () => {
        expect(command).toBeDefined();
        expect(subCommanderCommand).toBeDefined();
        expect(subCommanderCommand.name()).toBe('init');
    });

    test('init command has description', () => {
       expect(subCommanderCommand).toBeDefined();
       expect(subCommanderCommand.description()).toBeDefined();
    });

    test('init command has file as first argument', () => {
        const firstArg = subCommanderCommand._args[0];
        expect(firstArg).toBeDefined();
        expect(firstArg.required).toBe(true);
        expect(firstArg.name).toBe('file');
    });

    test('command has state bucket parameter with correct default', () => {
        const opts: Option[] = subCommanderCommand.options;
        const stateBucketOpt = opts.find((x) => x.long === '--state-bucket-name');
        expect(stateBucketOpt).toBeDefined();
        expect(subCommanderCommand.stateBucketName).toBe('organization-formation-${AWS::AccountId}');
    });

    test('command has state file parameter with correct default', () => {
        const opts: Option[] = subCommanderCommand.options;
        const stateObjectOpt = opts.find((x) => x.long === '--state-object');
        expect(stateObjectOpt).toBeDefined();
        expect(subCommanderCommand.stateObject).toBe('state.json');
    });

    test('command has region parameter', () => {
        const opts: Option[] = subCommanderCommand.options;
        const regionOpt = opts.find((x) => x.long === '--region');
        expect(regionOpt).toBeDefined();
        expect(regionOpt.required).toBe(true);
    });

    test('command has cross account role name parameter', () => {
        const opts: Option[] = subCommanderCommand.options;
        const regionOpt = opts.find((x) => x.long === '--cross-account-role-name');
        expect(regionOpt).toBeDefined();
        expect(regionOpt.required).toBe(true);
        expect(subCommanderCommand.crossAccountRoleName).toBe('OrganizationAccountAccessRole');
    });
});

describe('when executing init organization command', () => {
    let command: InitOrganizationCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;
    let getBuildProcessAccountIdStub: Sinon.SinonStub;
    let storageProviderCreateStub: Sinon.SinonStub;
    let storageProviderPutStub: Sinon.SinonStub;
    let generateDefaultTemplateStub: Sinon.SinonStub;
    let writeFileSyncStub: Sinon.SinonStub;
    const sandbox = Sinon.createSandbox();
    const masterAccountId = '112233445566';
    let commandArgs: IInitCommandArgs;
    let consoleInfo: Sinon.SinonStub;

    beforeEach(() => {
        consoleInfo = sandbox.stub(ConsoleUtil, 'LogInfo');

        getBuildProcessAccountIdStub = sandbox.stub(AwsUtil, 'GetBuildProcessAccountId');
        getBuildProcessAccountIdStub.returns(Promise.resolve(masterAccountId));

        generateDefaultTemplateStub = sandbox.stub(BaseCliCommand.prototype, 'generateDefaultTemplate');
        generateDefaultTemplateStub.returns(new DefaultTemplate('template', PersistedState.CreateEmpty(masterAccountId)));

        storageProviderCreateStub = sandbox.stub(S3StorageProvider.prototype, 'create');
        storageProviderPutStub = sandbox.stub(S3StorageProvider.prototype, 'put');
        sandbox.stub(S3StorageProvider.prototype, 'get');

        writeFileSyncStub = sandbox.stub(fs, 'writeFileSync');

        commanderCommand = new Command('root');
        command = new InitOrganizationCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];

        commandArgs = {...subCommanderCommand, region: 'eu-central-1', file: 'out.yml'} as unknown as IInitCommandArgs;

    });

    afterEach(() => {
        sandbox.restore();
    });

    test('calls getMasterAccountId', async () => {
        await command.performCommand(commandArgs);
        expect(getBuildProcessAccountIdStub.callCount).toBe(1);
    });

    test('has default cross account role name', async () => {
        await command.performCommand(commandArgs);
        expect(DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS.RoleName).toBe('OrganizationAccountAccessRole');
    });

    test('changed default role name when passing cross account role name', async ()=> {
        await command.performCommand({...commandArgs, crossAccountRoleName: 'CustomRoleName'});
        expect(DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS.RoleName).toBe('CustomRoleName');
    })

    test('creates bucket using masterAccountId and state bucket name', async () => {
            await command.performCommand(commandArgs);

            expect(storageProviderCreateStub.callCount).toBe(1);
            const createCallArgs = storageProviderCreateStub.lastCall.args;
            const tv: S3StorageProvider = storageProviderCreateStub.lastCall.thisValue;
            expect(tv.bucketName).toBe(`organization-formation-${masterAccountId}`);
            expect(createCallArgs[0]).toBe('eu-central-1');
        }
    );

    test('writes template to disk', async () => {
        await command.performCommand(commandArgs);
        expect(writeFileSyncStub.callCount).toBe(1);
        const callArgs = writeFileSyncStub.lastCall.args;
        expect(callArgs[0]).toBe(commandArgs.file);
        expect(callArgs[1]).toBe('template');
    });

    test('stores state in state bucket', async () => {
        commandArgs.stateObject = 'state-file-name.yml';
        await command.performCommand(commandArgs);

        const instance: S3StorageProvider = storageProviderCreateStub.lastCall.thisValue;
        expect(instance.bucketName).toBe(`organization-formation-${masterAccountId}`);
        expect(instance.objectKey).toBe('state-file-name.yml');

        const putCallArgs = storageProviderPutStub.lastCall.args;
        const contents: string = putCallArgs[0];
        const state: IState = JSON.parse(contents);
        expect(state.masterAccountId).toBe(masterAccountId);
    });

    test('if bucket already exists process continues', async () => {
        storageProviderCreateStub.throws({ name: 'BucketAlreadyOwnedByYou'});

        await command.performCommand(commandArgs);
        expect(writeFileSyncStub.callCount).toBe(1);
    });

    test('if bucket cannot be created exception is retrown', async () => {
        const error =  {code: 'SomeOtherException'};
        storageProviderCreateStub.throws(error);

        try {
            await command.performCommand(commandArgs);
            throw Error('expected exception');
        } catch (err) {
            expect(err).toBe(error);
        }
        expect(writeFileSyncStub.callCount).toBe(0);
    });

    test('command prints friendly message', async () => {
        await command.performCommand(commandArgs);
        expect(consoleInfo.callCount).toBeGreaterThan(0);
        expect(consoleInfo.getCall(0).args[0]).toContain('Your organization template is written to')
    })
});
