import { expect } from 'chai';
import { Command, Option } from 'commander';
const fs = require('fs');
import Sinon = require('sinon');
import { AwsUtil } from '../../../src/aws-util';
import { BaseCliCommand } from '../../../src/commands/base-command';
import { IInitCommandArgs, InitOrganizationCommand } from '../../../src/commands/init-organization';
import { IState, PersistedState } from '../../../src/state/persisted-state';
import { S3StorageProvider } from '../../../src/state/storage-provider';
import { DefaultTemplate } from '../../../src/writer/default-template-writer';

describe('when creating init organization command', () => {
    let command: InitOrganizationCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;

    beforeEach(() => {
        commanderCommand = new Command('root');
        command = new InitOrganizationCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];
    });

    it('init command is created', () => {
        expect(command).to.not.be.undefined;
        expect(subCommanderCommand).to.not.be.undefined;
        expect(subCommanderCommand.name()).to.eq('init');
    });

    it('init command has description', () => {
       expect(subCommanderCommand).to.not.be.undefined;
       expect(subCommanderCommand.description()).to.not.be.undefined;
    });

    it('init command has file as first argument', () => {
        const firstArg = subCommanderCommand._args[0];
        expect(firstArg).to.not.be.undefined;
        expect(firstArg.required).to.be.true;
        expect(firstArg.name).to.eq('file');
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

    it('command has region parameter', () => {
        const opts: Option[] = subCommanderCommand.options;
        const regionOpt = opts.find((x) => x.long === '--region');
        expect(regionOpt).to.not.be.undefined;
        expect(regionOpt.required).to.be.true;
    });
});

describe('when executing init organization command', () => {
    let command: InitOrganizationCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;
    let getMasterAccountIdStub: Sinon.SinonStub;
    let storageProviderCreateStub: Sinon.SinonStub;
    let storageProviderPutStub: Sinon.SinonStub;
    let storageProviderGetStub: Sinon.SinonStub;
    let generateDefaultTemplateStub: Sinon.SinonStub;
    let writeFileSyncStub: Sinon.SinonStub;
    const sandbox = Sinon.createSandbox();
    const masterAccountId = '112233445566';
    let commandArgs: IInitCommandArgs;

    beforeEach(() => {

        getMasterAccountIdStub = sandbox.stub(AwsUtil, 'GetMasterAccountId');
        getMasterAccountIdStub.returns(Promise.resolve(masterAccountId));

        generateDefaultTemplateStub = sandbox.stub(BaseCliCommand.prototype, 'generateDefaultTemplate');
        generateDefaultTemplateStub.returns(new DefaultTemplate('template', PersistedState.CreateEmpty(masterAccountId)));

        storageProviderCreateStub = sandbox.stub(S3StorageProvider.prototype, 'create');
        storageProviderPutStub = sandbox.stub(S3StorageProvider.prototype, 'put');
        storageProviderGetStub = sandbox.stub(S3StorageProvider.prototype, 'get');

        writeFileSyncStub = sandbox.stub(fs, 'writeFileSync');

        commanderCommand = new Command('root');
        command = new InitOrganizationCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];

        commandArgs = {...subCommanderCommand, region: 'eu-central-1', file: 'out.yml'} as unknown as IInitCommandArgs;

    });

    afterEach(() => {
        sandbox.restore();
    });

    it('calls getMasterAccountId', async () => {
        await command.performCommand(commandArgs);
        expect(getMasterAccountIdStub.callCount).to.eq(1);
    });

    it('creates bucket using masterAccountId and state bucket name', async () => {
        await command.performCommand(commandArgs);

        expect(storageProviderCreateStub.callCount).to.eq(1);
        const createCallArgs = storageProviderCreateStub.lastCall.args;
        const tv: S3StorageProvider = storageProviderCreateStub.lastCall.thisValue;
        expect(tv.bucketName).to.eq(`organization-formation-${masterAccountId}`);
        expect(createCallArgs[0]).to.eq('eu-central-1');
    });

    it('writes template to disk', async () => {
        await command.performCommand(commandArgs);
        expect(writeFileSyncStub.callCount).to.eq(1);
        const callArgs = writeFileSyncStub.lastCall.args;
        expect(callArgs[0]).to.eq(commandArgs.file);
        expect(callArgs[1]).to.eq('template');
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

    it('if bucket already exists process continues', async () => {
        storageProviderCreateStub.throws({ code: 'BucketAlreadyOwnedByYou'});

        await command.performCommand(commandArgs);
        expect(writeFileSyncStub.callCount).to.eq(1);
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
