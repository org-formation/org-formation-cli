import { expect } from 'chai';
import { Command, Option } from 'commander';
import { existsSync } from 'fs';
import Sinon = require('sinon');
import { AwsUtil } from '../../../src/aws-util';
import { BaseCliCommand } from '../../../src/commands/base-command';
import { IInitPipelineCommandArgs, InitPipelineCommand } from '../../../src/commands/init-organization-pipeline';
import { FileUtil } from '../../../src/file-util';
import { IState, PersistedState } from '../../../src/state/persisted-state';
import { S3StorageProvider } from '../../../src/state/storage-provider';
import { DefaultTemplate } from '../../../src/writer/default-template-writer';

describe('when creating init organization pipeline command', () => {
    let command: InitPipelineCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;

    beforeEach(() => {
        commanderCommand = new Command('root');
        command = new InitPipelineCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];
    });

    it('init pipeline command is created', () => {
        expect(command).to.not.be.undefined;
        expect(subCommanderCommand).to.not.be.undefined;
        expect(subCommanderCommand.name()).to.eq('init-pipeline');
    });

    it('init pipeline command has description', () => {
       expect(subCommanderCommand).to.not.be.undefined;
       expect(subCommanderCommand.description()).to.not.be.undefined;
    });

    it('init pipeline command has no arguments', () => {
        expect(subCommanderCommand._args.length).to.eq(0);
    });

    it('command has state bucket parameter with correct default', () => {
        const opts: Option[] = subCommanderCommand.options;
        const stateBucketOpt = opts.find((x) => x.long === '--state-bucket-name');
        expect(stateBucketOpt).to.not.be.undefined;
        expect(subCommanderCommand.stateBucketName).to.eq('organization-formation-${AWS::AccountId}');
    });

    it('command has state file parameter with correct default', () => {
        const opts: Option[] = subCommanderCommand.options;
        const stateObjectOpt = opts.find((x) => x.long === '--state-object');
        expect(stateObjectOpt).to.not.be.undefined;
        expect(subCommanderCommand.stateObject).to.eq('state.json');
    });

    it('command has region option', () => {
        const opts: Option[] = subCommanderCommand.options;
        const regionOpt = opts.find((x) => x.long === '--region');
        expect(regionOpt).to.not.be.undefined;
        expect(regionOpt.required).to.be.true;
    });

    it('command has stack-name option', () => {
        const opts: Option[] = subCommanderCommand.options;
        const stackNameOpt = opts.find((x) => x.long === '--stack-name');
        expect(stackNameOpt).to.not.be.undefined;
        expect(stackNameOpt.required).to.be.true;
        expect(subCommanderCommand.stackName).to.eq('organization-formation-build');
    });

    it('command has resource-prefix option', () => {
        const opts: Option[] = subCommanderCommand.options;
        const resourcePrefixOpt = opts.find((x) => x.long === '--resource-prefix');
        expect(resourcePrefixOpt).to.not.be.undefined;
        expect(resourcePrefixOpt.required).to.be.true;
        expect(subCommanderCommand.resourcePrefix).to.eq('orgformation');
    });

    it('command has repository-name option', () => {
        const opts: Option[] = subCommanderCommand.options;
        const repositoryNameOpt = opts.find((x) => x.long === '--repository-name');
        expect(repositoryNameOpt).to.not.be.undefined;
        expect(repositoryNameOpt.required).to.be.true;
        expect(subCommanderCommand.repositoryName).to.eq('organization-formation');
    });

});

describe('when executing init pipeline command', () => {
    let command: InitPipelineCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;
    let getMasterAccountIdStub: Sinon.SinonStub;
    let storageProviderCreateStub: Sinon.SinonStub;
    let storageProviderPutStub: Sinon.SinonStub;
    let storageProviderGetStub: Sinon.SinonStub;
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
        storageProviderGetStub = sandbox.stub(S3StorageProvider.prototype, 'get');

        writeFileSyncStub = sandbox.stub(FileUtil, 'writeFileSync');

        commanderCommand = new Command('root');
        command = new InitPipelineCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];

        deleteObjectStub = sandbox.stub(AwsUtil, 'DeleteObject');

        commandArgs = {...subCommanderCommand, region: 'eu-central-1', file: 'out.yml'} as unknown as IInitPipelineCommandArgs;

    });

    afterEach(() => {
        sandbox.restore();
    });

    it('calls getMasterAccountId', async () => {
        await command.performCommand(commandArgs);
        expect(getMasterAccountIdStub.callCount).to.eq(1);
    });

    it('creates initial commit', async () => {
        await command.performCommand(commandArgs);
        expect(uploadInitialCommitStub.callCount).to.eq(1);
    });

    it('executes stack that creates build infra', async () => {
        await command.performCommand(commandArgs);
        expect(executeStackStub.callCount).to.eq(1);
        const args = executeStackStub.lastCall.args;
        const cfnTemplate = args[0] as string;
        const region = args[1] as string;
        const stateBucketName = args[2] as string;
        const resourcePrefix = args[3] as string;
        const stackName = args[4] as string;

        expect(cfnTemplate).to.contain('AWSTemplateFormatVersion: \'2010-09-09\'');
        expect(region).to.eq(commandArgs.region);
        expect(stateBucketName).to.eq(`organization-formation-${masterAccountId}`);
        expect(resourcePrefix).to.eq(commandArgs.resourcePrefix);
        expect(stackName).to.eq(commandArgs.stackName);
    });

    it('creates bucket using masterAccountId and state bucket name', async () => {
        await command.performCommand(commandArgs);

        expect(storageProviderCreateStub.callCount).to.eq(1);
        const createCallArgs = storageProviderCreateStub.lastCall.args;
        const tv: S3StorageProvider = storageProviderCreateStub.lastCall.thisValue;
        expect(tv.bucketName).to.eq(`organization-formation-${masterAccountId}`);
        expect(createCallArgs[0]).to.eq('eu-central-1');
    });

    it('does not writes to disk', async () => {
        await command.performCommand(commandArgs);
        expect(writeFileSyncStub.callCount).to.eq(0);
    });

    it('deletes initial commit from s3', async () => {
        await command.performCommand(commandArgs);
        expect(deleteObjectStub.callCount).to.eq(1);
        const args = deleteObjectStub.lastCall.args;
        const stateBucketName = args[0] as string;
        const objectKey = args[1] as string;

        expect(stateBucketName).to.eq(stateBucketName);
        expect(objectKey).to.eq('initial-commit.zip');
    });

    it('stores state in state bucket', async () => {
        commandArgs.stateObject = 'state-file-name.yml';
        await command.performCommand(commandArgs);

        const instance: S3StorageProvider = storageProviderCreateStub.lastCall.thisValue;
        expect(instance.bucketName).to.eq(`organization-formation-${masterAccountId}`);
        expect(instance.objectKey).to.eq('state-file-name.yml');

        const putCallArgs = storageProviderPutStub.lastCall.args;
        const contents: string = putCallArgs[0];
        const state: IState = JSON.parse(contents);
        expect(state.masterAccountId).to.eq(masterAccountId);
    });

    it('if bucket already exists calls continue', async () => {
        storageProviderCreateStub.throws({ code: 'BucketAlreadyOwnedByYou'});

        await command.performCommand(commandArgs);
        expect(uploadInitialCommitStub.callCount).to.eq(1);
        expect(uploadInitialCommitStub.callCount).to.eq(1);
    });

    it('if bucket cannot be created exception is retrown', async () => {
        const error =  {code: 'SomeOtherException'};
        storageProviderCreateStub.throws(error);

        try {
            await command.performCommand(commandArgs);
            throw Error('expeted exception');
        } catch (err) {
            expect(err).to.eq(error);
        }
        expect(writeFileSyncStub.callCount).to.eq(0);
    });

    it('throws exception if region is undefined', async () => {
        delete commandArgs.region;

        try {
            await command.performCommand(commandArgs);
            throw Error('expeted exception');
        } catch (err) {
            expect(err.message).to.contain('region');
        }
        expect(storageProviderCreateStub.callCount).to.eq(0);
        expect(writeFileSyncStub.callCount).to.eq(0);
    });
});
