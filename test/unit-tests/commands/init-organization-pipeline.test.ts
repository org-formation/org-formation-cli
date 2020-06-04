import { Command, Option } from 'commander';
import * as fs from 'fs';
import Sinon from 'sinon';
import { AwsUtil, DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS } from '~util/aws-util';
import { BaseCliCommand } from '~commands/base-command';
import { IInitPipelineCommandArgs, InitPipelineCommand } from '~commands/init-organization-pipeline';
import { IState, PersistedState } from '~state/persisted-state';
import { S3StorageProvider } from '~state/storage-provider';
import { DefaultTemplate } from '~writer/default-template-writer';
import { ConsoleUtil } from '~util/console-util';

describe('when creating init organization pipeline command', () => {
    let command: InitPipelineCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;
    let sandbox = Sinon.createSandbox();

    beforeEach(() => {
        commanderCommand = new Command('root');
        command = new InitPipelineCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];
        sandbox.stub(ConsoleUtil, 'LogInfo');
    });

    afterEach(() => {
        sandbox.restore();
    })

    test('init pipeline command is created', () => {
        expect(command).toBeDefined();
        expect(subCommanderCommand).toBeDefined();
        expect(subCommanderCommand.name()).toBe('init-pipeline');
    });

    test('init pipeline command has description', () => {
       expect(subCommanderCommand).toBeDefined();
       expect(subCommanderCommand.description()).toBeDefined();
    });

    test('init pipeline command has no arguments', () => {
        expect(subCommanderCommand._args.length).toBe(0);
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

    test('command has region option', () => {
        const opts: Option[] = subCommanderCommand.options;
        const regionOpt = opts.find((x) => x.long === '--region');
        expect(regionOpt).toBeDefined();
        expect(regionOpt.required).toBe(true);
    });

    test('command has stack-name option', () => {
        const opts: Option[] = subCommanderCommand.options;
        const stackNameOpt = opts.find((x) => x.long === '--stack-name');
        expect(stackNameOpt).toBeDefined();
        expect(stackNameOpt.required).toBe(true);
        expect(subCommanderCommand.stackName).toBe('organization-formation-build');
    });

    test('command has resource-prefix option', () => {
        const opts: Option[] = subCommanderCommand.options;
        const resourcePrefixOpt = opts.find((x) => x.long === '--resource-prefix');
        expect(resourcePrefixOpt).toBeDefined();
        expect(resourcePrefixOpt.required).toBe(true);
        expect(subCommanderCommand.resourcePrefix).toBe('orgformation');
    });

    test('command has repository-name option', () => {
        const opts: Option[] = subCommanderCommand.options;
        const repositoryNameOpt = opts.find((x) => x.long === '--repository-name');
        expect(repositoryNameOpt).toBeDefined();
        expect(repositoryNameOpt.required).toBe(true);
        expect(subCommanderCommand.repositoryName).toBe('organization-formation');
    });

    test('command has cross account role name parameter', () => {
        const opts: Option[] = subCommanderCommand.options;
        const regionOpt = opts.find((x) => x.long === '--cross-account-role-name');
        expect(regionOpt).toBeDefined();
        expect(regionOpt.required).toBe(true);
        expect(subCommanderCommand.crossAccountRoleName).toBe('OrganizationAccountAccessRole');
    });
});

describe('when executing init pipeline command', () => {
    let command: InitPipelineCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;
    let getMasterAccountIdStub: Sinon.SinonStub;
    let storageProviderCreateStub: Sinon.SinonStub;
    let storageProviderPutStub: Sinon.SinonStub;
    let generateDefaultTemplateStub: Sinon.SinonStub;
    let uploadInitialCommitStub: Sinon.SinonStub;
    let executeStackStub: Sinon.SinonStub;
    let deleteObjectStub: Sinon.SinonSpy;

    let writeFileSyncStub: Sinon.SinonStub;
    const sandbox = Sinon.createSandbox();
    const masterAccountId = '112233445566';
    let commandArgs: IInitPipelineCommandArgs;

    beforeEach(() => {

        getMasterAccountIdStub = sandbox.stub(AwsUtil, 'GetMasterAccountId');
        getMasterAccountIdStub.returns(Promise.resolve(masterAccountId));

        uploadInitialCommitStub = sandbox.stub(InitPipelineCommand.prototype, 'uploadInitialCommit');
        executeStackStub = sandbox.stub(InitPipelineCommand.prototype, 'executeStack');

        generateDefaultTemplateStub = sandbox.stub(BaseCliCommand.prototype, 'generateDefaultTemplate');
        generateDefaultTemplateStub.returns(new DefaultTemplate('template', PersistedState.CreateEmpty(masterAccountId)));

        storageProviderCreateStub = sandbox.stub(S3StorageProvider.prototype, 'create');
        storageProviderPutStub = sandbox.stub(S3StorageProvider.prototype, 'put');
        sandbox.stub(S3StorageProvider.prototype, 'get');
        sandbox.stub(ConsoleUtil, 'LogInfo');

        writeFileSyncStub = sandbox.stub(fs, 'writeFileSync');

        commanderCommand = new Command('root');
        command = new InitPipelineCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];

        deleteObjectStub = sandbox.stub(AwsUtil, 'DeleteObject');

        commandArgs = {...subCommanderCommand, region: 'eu-central-1', file: 'out.yml' } as unknown as IInitPipelineCommandArgs;

    });

    afterEach(() => {
        sandbox.restore();
    });

    test('calls getMasterAccountId', async () => {
        await command.performCommand(commandArgs);
        expect(getMasterAccountIdStub.callCount).toBe(1);
    });


    test('has default cross account role name', async () => {
        await command.performCommand(commandArgs);
        expect(DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS.RoleName).toBe('OrganizationAccountAccessRole');
    });

    test('changed default role name when passing cross account role name', async ()=> {
        await command.performCommand({...commandArgs, crossAccountRoleName: 'CustomRoleName'});
        expect(DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS.RoleName).toBe('CustomRoleName');
    })

    test('creates initial commit', async () => {
        await command.performCommand(commandArgs);
        expect(uploadInitialCommitStub.callCount).toBe(1);
    });

    test('executes stack that creates build infra', async () => {
        await command.performCommand(commandArgs);
        expect(executeStackStub.callCount).toBe(1);
        const args = executeStackStub.lastCall.args;
        const cfnTemplate = args[0] as string;
        const region = args[1] as string;
        const stateBucketName = args[2] as string;
        const resourcePrefix = args[3] as string;
        const stackName = args[4] as string;

        expect(cfnTemplate).toEqual(expect.stringContaining('AWSTemplateFormatVersion: \'2010-09-09\''));
        expect(region).toBe(commandArgs.region);
        expect(stateBucketName).toBe(`organization-formation-${masterAccountId}`);
        expect(resourcePrefix).toBe(commandArgs.resourcePrefix);
        expect(stackName).toBe(commandArgs.stackName);
    });

    test(
        'creates bucket using masterAccountId and state bucket name',
        async () => {
            await command.performCommand(commandArgs);

            expect(storageProviderCreateStub.callCount).toBe(1);
            const createCallArgs = storageProviderCreateStub.lastCall.args;
            const tv: S3StorageProvider = storageProviderCreateStub.lastCall.thisValue;
            expect(tv.bucketName).toBe(`organization-formation-${masterAccountId}`);
            expect(createCallArgs[0]).toBe('eu-central-1');
        }
    );

    test('does not writes to disk', async () => {
        await command.performCommand(commandArgs);
        expect(writeFileSyncStub.callCount).toBe(0);
    });

    test('deletes initial commit from s3', async () => {
        await command.performCommand(commandArgs);
        expect(deleteObjectStub.callCount).toBe(1);
        const args = deleteObjectStub.lastCall.args;
        const stateBucketName = args[0] as string;
        const objectKey = args[1] as string;

        expect(stateBucketName).toBe(stateBucketName);
        expect(objectKey).toBe('initial-commit.zip');
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

    test('if bucket already exists calls continue', async () => {
        storageProviderCreateStub.throws({ code: 'BucketAlreadyOwnedByYou'});

        await command.performCommand(commandArgs);
        expect(uploadInitialCommitStub.callCount).toBe(1);
        expect(uploadInitialCommitStub.callCount).toBe(1);
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

    test('throws exception if region is undefined', async () => {
        delete commandArgs.region;

        try {
            await command.performCommand(commandArgs);
            throw Error('expected exception');
        } catch (err) {
            expect(err.message).toEqual(expect.stringContaining('region'));
        }
        expect(storageProviderCreateStub.callCount).toBe(0);
        expect(writeFileSyncStub.callCount).toBe(0);
    });
});
