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
import { OrgResourceTypes } from '~parser/model';
import { CredentialsOptions } from 'aws-sdk/lib/credentials';
import { STS } from 'aws-sdk';

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
        const crossAcctRoleName = opts.find((x) => x.long === '--cross-account-role-name');
        expect(crossAcctRoleName).toBeDefined();
        expect(crossAcctRoleName.required).toBe(true);
        expect(subCommanderCommand.crossAccountRoleName).toBe('OrganizationAccountAccessRole');
    });

    test('command has build account id parameter', () => {
        const opts: Option[] = subCommanderCommand.options;
        const buildAcct = opts.find((x) => x.long === '--build-account-id');
        expect(buildAcct).toBeDefined();
        expect(buildAcct.required).toBe(false);
        expect(subCommanderCommand.buildAccountId).toBeUndefined();
    });

    test('command has role stack name parameter', () => {
        const opts: Option[] = subCommanderCommand.options;
        const roleStackName = opts.find((x) => x.long === '--role-stack-name');
        expect(roleStackName).toBeDefined();
        expect(roleStackName.required).toBe(false);
    });
});

describe('when executing init pipeline', () => {
    let command: InitPipelineCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;
    let getMasterAccountIdStub: Sinon.SinonStub;
    let storageProviderCreateStub: Sinon.SinonStub;
    let storageProviderPutStub: Sinon.SinonStub;
    let generateDefaultTemplateStub: Sinon.SinonStub;
    let uploadInitialCommitStub: Sinon.SinonStub;
    let executePipelineStackStackStub: Sinon.SinonStub;
    let executeRoleStackStackStub: Sinon.SinonStub;
    let deleteObjectStub: Sinon.SinonSpy;

    let writeFileSyncStub: Sinon.SinonStub;
    const sandbox = Sinon.createSandbox();
    const masterAccountId = '112233445566';
    let commandArgs: IInitPipelineCommandArgs;

    beforeEach(() => {

        getMasterAccountIdStub = sandbox.stub(AwsUtil, 'GetMasterAccountId');
        getMasterAccountIdStub.returns(Promise.resolve(masterAccountId));

        uploadInitialCommitStub = sandbox.stub(InitPipelineCommand.prototype, 'uploadInitialCommit');
        executePipelineStackStackStub = sandbox.stub(InitPipelineCommand.prototype, 'executePipelineStack');
        executeRoleStackStackStub = sandbox.stub(InitPipelineCommand.prototype, 'executeOrgFormationRoleStack');

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

        commandArgs = { ...subCommanderCommand, region: 'eu-central-1', file: 'out.yml' } as unknown as IInitPipelineCommandArgs;

    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('without build acct parameter', () => {
        test('calls getMasterAccountIdStub', async () => {
            await command.performCommand(commandArgs);
            expect(getMasterAccountIdStub.callCount).toBe(1);
        });

        test('has default cross account role name', async () => {
            await command.performCommand(commandArgs);
            expect(DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS.RoleName).toBe('OrganizationAccountAccessRole');
        });

        test('changed default role name when passing cross account role name', async () => {
            await command.performCommand({ ...commandArgs, crossAccountRoleName: 'CustomRoleName' });
            expect(DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS.RoleName).toBe('CustomRoleName');
        })

        test('creates initial commit', async () => {
            await command.performCommand(commandArgs);
            expect(uploadInitialCommitStub.callCount).toBe(1);
        });

        test('executes stack that creates build infra', async () => {
            await command.performCommand(commandArgs);
            expect(executePipelineStackStackStub.callCount).toBe(1);
            const args = executePipelineStackStackStub.lastCall.args;
            const targetAccountId = args[0] as string;
            const cfnTemplate = args[1] as string;
            const region = args[2] as string;
            const stateBucketName = args[3] as string;
            const resourcePrefix = args[4] as string;
            const stackName = args[5] as string;

            expect(cfnTemplate).toEqual(expect.stringContaining('AWSTemplateFormatVersion: \'2010-09-09\''));
            expect(region).toBe(commandArgs.region);
            expect(stateBucketName).toBe(`organization-formation-${masterAccountId}`);
            expect(resourcePrefix).toBe(commandArgs.resourcePrefix);
            expect(stackName).toBe(commandArgs.stackName);
            expect(targetAccountId).toBe(masterAccountId);
        });

        test('does not execute stack that creates build role', async () => {
            await command.performCommand(commandArgs);
            expect(executeRoleStackStackStub.callCount).toBe(0);
        });

        test('creates bucket using masterAccountId and state bucket name', async () => {
            await command.performCommand(commandArgs);

            expect(storageProviderCreateStub.callCount).toBe(1);
            const createCallArgs = storageProviderCreateStub.lastCall.args;
            const tv: S3StorageProvider = storageProviderCreateStub.lastCall.thisValue;
            expect(tv.bucketName).toBe(`organization-formation-${masterAccountId}`);
            expect(createCallArgs[0]).toBe('eu-central-1');
        });

        test('generate default template was called without build access role name', async () => {
            await command.performCommand(commandArgs);

            expect(generateDefaultTemplateStub.callCount).toBe(1);
            const roleName = generateDefaultTemplateStub.getCall(0).args[0];
            expect(roleName).toBeUndefined();
        });

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

    describe('with build acct id parameter', () => {

        let buildAccountId = '111222333444';
        let getBuildAccCredentials: Sinon.SinonStub;
        beforeEach(() => {
            commandArgs.buildAccountId = buildAccountId;

            const generatedState = PersistedState.CreateEmpty(masterAccountId);
            generatedState.setBinding({ physicalId: commandArgs.buildAccountId, type: OrgResourceTypes.Account, logicalId: 'MyBuildAcct', lastCommittedHash: 'zxx'});
            generateDefaultTemplateStub.returns(new DefaultTemplate('template', generatedState));

            getBuildAccCredentials = sandbox.stub(AwsUtil, 'GetCredentials');
            getBuildAccCredentials.returns( Promise.resolve({ accessKeyId: 'access-key-id', secretAccessKey: 'secret, ssst' } as CredentialsOptions) );
        });

        test('build access role name is passed to template writer', async () => {
            await command.performCommand(commandArgs);

            expect(generateDefaultTemplateStub.callCount).toBe(1);
            const roleName = generateDefaultTemplateStub.getCall(0).args[0];
            expect(roleName).toBeDefined();
            expect(roleName).toBe('OrganizationFormationBuildAccessRole');
        });

        test('executes stack that creates build infra', async () => {
            await command.performCommand(commandArgs);
            expect(executePipelineStackStackStub.callCount).toBe(1);
            const args = executePipelineStackStackStub.lastCall.args;
            const targetAccountId = args[0] as string;
            const cfnTemplate = args[1] as string;
            const region = args[2] as string;
            const stateBucketName = args[3] as string;
            const resourcePrefix = args[4] as string;
            const stackName = args[5] as string;

            expect(cfnTemplate).toEqual(expect.stringContaining('AWSTemplateFormatVersion: \'2010-09-09\''));
            expect(region).toBe(commandArgs.region);
            expect(stateBucketName).toBe(`organization-formation-${buildAccountId}`);
            expect(resourcePrefix).toBe(commandArgs.resourcePrefix);
            expect(stackName).toBe(commandArgs.stackName);
            expect(targetAccountId).toBe(buildAccountId);
        });

        test('executes stack that creates build role', async () => {
            await command.performCommand(commandArgs);
            expect(executeRoleStackStackStub.callCount).toBe(1);
            const args = executeRoleStackStackStub.lastCall.args;
            const targetAccountId = args[0] as string;
            const buildAcctId = args[1] as string;
            const cfnTemplate = args[2] as string;
            const region = args[3] as string;
            const stackName = args[4] as string;

            expect(cfnTemplate).toEqual(expect.stringContaining('AWSTemplateFormatVersion: \'2010-09-09\''));
            expect(buildAcctId).toBe(buildAccountId);
            expect(region).toBe(commandArgs.region);
            expect(stackName).toBe(commandArgs.roleStackName);
            expect(targetAccountId).toBe(masterAccountId);
        });

        test('credentials are queried for build acct', async () => {
            await command.performCommand(commandArgs);

            expect(getBuildAccCredentials.callCount).toBe(1);
            const account = getBuildAccCredentials.getCall(0).args[0];
            const roleName = getBuildAccCredentials.getCall(0).args[1];
            expect(account).toBe(buildAccountId);
            expect(roleName).toBe('OrganizationAccountAccessRole');
        });
    })
});
