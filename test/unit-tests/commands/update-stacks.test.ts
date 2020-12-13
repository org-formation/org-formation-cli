import { Command, Option } from 'commander';
import Sinon from 'sinon';
import { IUpdateStacksCommandArgs, UpdateStacksCommand } from '~commands/update-stacks';
import { TemplateRoot } from '~parser/parser';
import { ConsoleUtil } from '~util/console-util';
import { CloudFormationBinder } from '~cfn-binder/cfn-binder';
import { S3StorageProvider } from '~state/storage-provider';
import { AwsUtil } from '~util/aws-util';
import { PersistedState } from '~state/persisted-state';
import { ICfnTask } from '~cfn-binder/cfn-task-provider';
import { CfnTaskRunner } from '~cfn-binder/cfn-task-runner';
import { GlobalState } from '~util/global-state';

describe('when creating update stacks command', () => {
    let command: UpdateStacksCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;

    beforeEach(() => {
        commanderCommand = new Command('root');
        command = new UpdateStacksCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];
    });

    test('update stacks command is created', () => {
        expect(command).toBeDefined();
        expect(subCommanderCommand).toBeDefined();
        expect(subCommanderCommand.name()).toBe('update-stacks');
    });

    test('update stacks command has description', () => {
       expect(subCommanderCommand).toBeDefined();
       expect(subCommanderCommand.description()).toBeDefined();
    });

    test('update stacks command has templateFile as first argument', () => {
        const firstArg = subCommanderCommand._args[0];
        expect(firstArg).toBeDefined();
        expect(firstArg.required).toBe(true);
        expect(firstArg.name).toBe('templateFile');
    });

    test('command has max concurrent tasks parameter with correct default', () => {
        const opts: Option[] = subCommanderCommand.options;
        const maxConcurrentStacksOpt = opts.find((x) => x.long === '--max-concurrent-stacks');
        expect(maxConcurrentStacksOpt).toBeDefined();
        expect(subCommanderCommand.maxConcurrentStacks).toBe(1);
    });

    test('command has failure tolerance parameter with correct default', () => {
        const opts: Option[] = subCommanderCommand.options;
        const failedTaskTolerance = opts.find((x) => x.long === '--failed-stacks-tolerance');
        expect(failedTaskTolerance).toBeDefined();
        expect(subCommanderCommand.failedStacksTolerance).toBe(0);
    });

    test('command has required stackname parameter without', () => {
        const opts: Option[] = subCommanderCommand.options;
        const stackNameOpt = opts.find((x) => x.long === '--stack-name');
        expect(stackNameOpt).toBeDefined();
        expect(stackNameOpt.required).toBeTruthy();
    });

    test('command has parameters parameter with correct default', () => {
        const opts: Option[] = subCommanderCommand.options;
        const parametersOpt = opts.find((x) => x.long === '--parameters');
        expect(parametersOpt).toBeDefined();
        expect(subCommanderCommand.parameters).toBeUndefined();
    });

    test('command has termination protection parameter with correct default', () => {
        const opts: Option[] = subCommanderCommand.options;
        const terminationProtectionOpt = opts.find((x) => x.long === '--termination-protection');
        expect(terminationProtectionOpt).toBeDefined();
        expect(subCommanderCommand.terminationProtection).toBeFalsy();
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
});


describe('when executing update-stacks command', () => {
    let command: UpdateStacksCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;
    let createTemplate: Sinon.SinonStub;
    let enumTasks: Sinon.SinonStub;
    let saveState: Sinon.SinonStub;
    let runTasks: Sinon.SinonSpy;
    let storageProviderGet: Sinon.SinonStub;
    const sandbox = Sinon.createSandbox();
    let commandArgs: IUpdateStacksCommandArgs;
    let consoleInfo: Sinon.SinonStub;
    let consoleError: Sinon.SinonStub;

    beforeEach(() => {
        consoleInfo = sandbox.stub(ConsoleUtil, 'LogInfo');
        consoleError = sandbox.stub(ConsoleUtil, 'LogError');
        sandbox.stub(ConsoleUtil, 'LogWarning');

        commanderCommand = new Command('root');
        command = new UpdateStacksCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];

        sandbox.stub(AwsUtil, 'GetMasterAccountId').returns(Promise.resolve('123456789012'));
        sandbox.stub(AwsUtil, 'GetBuildProcessAccountId').returns(Promise.resolve('123456789012'));

        const template = TemplateRoot.create('./test/resources/cloudformation-template.yml', {
            OrganizationFile:  './test/resources/valid-basic.yml',
            DefaultOrganizationBinding: { Account: '*', Region: 'eu-central-1'}
        });

        const emptyState = PersistedState.CreateEmpty('123456789012');
        createTemplate = sandbox.stub(TemplateRoot, 'create');
        createTemplate.returns(template);

        saveState = sandbox.stub(PersistedState.prototype, 'save');
        storageProviderGet = sandbox.stub(S3StorageProvider.prototype, 'get');
        storageProviderGet.returns(emptyState.toJson());

        enumTasks = sandbox.stub(CloudFormationBinder.prototype, 'enumTasks');
        enumTasks.returns([{
            action: 'update',
            accountId: '123456789012',
            region: 'eu-central-1',
            stackName: 'myStackName',
            perform: () => {
                emptyState.setTarget({logicalAccountId: 'MasterAccount', accountId: '123456789012', region: 'eu-central-1', stackName: 'myStackName', lastCommittedHash: 'aaa'})
            },
            isDependency: (task: ICfnTask) => false,
        }]);

        runTasks = sandbox.spy(CfnTaskRunner, 'RunTasks');

        commandArgs = {
            ...subCommanderCommand,
            stackName: 'myStackName',
            templateFile: 'template.yml',
            maxConcurrentStacks: 6,
            failedStacksTolerance: 2,
        } as unknown as IUpdateStacksCommandArgs;
    });

    afterEach(() => {
        sandbox.restore();
    });

    test('global state is set', async () => {
        await command.performCommand(commandArgs);
        expect(GlobalState.State).toBeDefined();
        expect(GlobalState.OrganizationTemplate).toBeDefined();
    });

    test('s3 storage provider is used to get state', async () => {
        await command.performCommand(commandArgs);
        expect(storageProviderGet.callCount).toBe(1);
    });


    test('enum tasks is called to get tasks', async () => {
        await command.performCommand(commandArgs);
        expect(enumTasks.callCount).toBe(1);
    });

    test('create template is called to create template', async () => {
        await command.performCommand(commandArgs);
        expect(createTemplate.callCount).toBe(1);
        expect(createTemplate.lastCall.args[0]).toBe('template.yml');
    });

    test('task runner has ran', async () => {
        await command.performCommand(commandArgs);
        expect(runTasks.callCount).toBe(1);
        expect(Array.isArray(runTasks.getCall(0).args[0])).toBeTruthy();
        expect(runTasks.getCall(0).args[1]).toBe(commandArgs.stackName);
        expect(runTasks.getCall(0).args[2]).toBe(false);
        expect(runTasks.getCall(0).args[3]).toBe(commandArgs.maxConcurrentStacks);
        expect(runTasks.getCall(0).args[4]).toBe(commandArgs.failedStacksTolerance)
    });

    test('state is saved', async () => {
        await command.performCommand(commandArgs);
        expect(saveState.callCount).toBe(1);
    });

    test('no error is logged', async () => {
        await command.performCommand(commandArgs);
        expect(consoleError.callCount).toBe(0);
    });

    test('stack update is logged', async () => {
        await command.performCommand(commandArgs);
        expect(consoleInfo.callCount).toBe(1);
        expect(consoleInfo.getCall(0).args[0]).toContain('123456789012');
        expect(consoleInfo.getCall(0).args[0]).toContain('Stack myStackName');
        expect(consoleInfo.getCall(0).args[0]).toContain('update');
    });

    describe('and no tasks are returned', () => {
        beforeEach(() => {
            enumTasks.returns([]);
        });

        afterEach(()=> {
            sandbox.restore();
        });

        test('state is not saved', async () => {
            await command.performCommand(commandArgs);
            expect(saveState.callCount).toBe(0);
        });

        test('task runner has not ran', async () => {
            await command.performCommand(commandArgs);
            expect(runTasks.callCount).toBe(0);
        });

        test('done is logged to console', async () => {
            await command.performCommand(commandArgs);
            expect(consoleInfo.callCount).toBe(1);
            expect(consoleInfo.lastCall.args[0]).toContain('already up to date');
            expect(consoleInfo.lastCall.args[0]).toContain('Stack myStackName');
        });
    });
    describe('and tasks throws', () => {
        beforeEach(() => {
            enumTasks.returns([{
                action: 'update',
                accountId: '123456789012',
                region: 'eu-central-1',
                stackName: 'myStackName',
                perform: () => {
                    throw Error('test error');
                },
                isDependency: (task: ICfnTask) => false,
            }]);

        });

        afterEach(()=> {
            sandbox.restore();
        });

        test('state is saved', async () => {
            await command.performCommand(commandArgs);
            expect(saveState.callCount).toBe(1);
        });

        test('error is logged to console', async () => {
            await command.performCommand(commandArgs);
            expect(consoleError.callCount).toBe(1);
            expect(consoleError.firstCall.args[0]).toContain('failed');
            expect(consoleError.firstCall.args[0]).toContain('Stack myStackName');
            expect(consoleError.firstCall.args[0]).toContain('account 123456789012');
        });
    });
    describe('and parameters are passed as string', () => {
        beforeEach(() => {
            commandArgs.parameters = 'Key=Val Key2=Val2';
        });

        afterEach(()=> {
            sandbox.restore();
        });

        test('parameters are passed to binder', async () => {
            await command.performCommand(commandArgs);
            expect(enumTasks.getCall(0).thisValue).toBeDefined();
            const binder = enumTasks.getCall(0).thisValue;
            expect(binder.parameters).toBeDefined();
            expect(binder.parameters['Key']).toBeDefined();
            expect(binder.parameters['Key']).toBe('Val');
            expect(binder.parameters['Key2']).toBeDefined();
            expect(binder.parameters['Key2']).toBe('Val2');

        });
    });
    describe('and parameters are passed as string (long)', () => {
        beforeEach(() => {
            commandArgs.parameters = 'ParameterKey=Key,ParameterValue=Val ParameterKey=Key2,ParameterValue=Val2';
        });

        afterEach(()=> {
            sandbox.restore();
        });

        test('parameters are passed to binder', async () => {
            await command.performCommand(commandArgs);
            expect(enumTasks.getCall(0).thisValue).toBeDefined();
            const binder = enumTasks.getCall(0).thisValue;
            expect(binder.parameters).toBeDefined();
            expect(binder.parameters['Key']).toBeDefined();
            expect(binder.parameters['Key']).toBe('Val');
            expect(binder.parameters['Key2']).toBeDefined();
            expect(binder.parameters['Key2']).toBe('Val2');

        });
    });
    describe('and parameters are passed as object', () => {
        beforeEach(() => {
            commandArgs.parameters = {Key: 'Val', Key2: 'Val2'};
        });

        afterEach(()=> {
            sandbox.restore();
        });
        test('parameters are passed to binder', async () => {
            await command.performCommand(commandArgs);
            expect(enumTasks.getCall(0).thisValue).toBeDefined();
            const binder = enumTasks.getCall(0).thisValue;
            expect(binder.parameters).toBeDefined();
            expect(binder.parameters['Key']).toBeDefined();
            expect(binder.parameters['Key']).toBe('Val');
            expect(binder.parameters['Key2']).toBeDefined();
            expect(binder.parameters['Key2']).toBe('Val2');

        });
    });
})



describe('when calling static perform method', () => {
    let performCommand: Sinon.SinonStub;
    let commandArgs: IUpdateStacksCommandArgs;
    const sandbox = Sinon.createSandbox();

    beforeEach(() => {
        performCommand = sandbox.stub(UpdateStacksCommand.prototype, 'performCommand');
        commandArgs = { templateFile: 'abc.yml', stackName: 'stackName'} as unknown as IUpdateStacksCommandArgs;
    });

    afterEach(() => {
        sandbox.restore();
    });

    test('static perform passes args to perform', async () => {
        await UpdateStacksCommand.Perform(commandArgs);
        expect(performCommand.callCount).toBe(1);
        expect(performCommand.getCall(0).args[0]).toBe(commandArgs);
    });
});
