import Sinon from 'sinon';
import { IBuildTask } from '~build-tasks/build-configuration';
import { BuildTaskProvider } from '~build-tasks/build-task-provider';
import { IUpdateStacksCommandArgs, UpdateStacksCommand } from '~commands/update-stacks';
import { ConsoleUtil } from '~util/console-util';
import { IUpdateStackTaskConfiguration } from '~build-tasks/tasks/update-stacks-task';
import { IPerformTasksCommandArgs } from '~commands/index';
import { CfnExpressionResolver } from '~core/cfn-expression-resolver';

describe('when creating UpdateStacksTask task', () => {
    let task: IBuildTask;
    let updateStacksResources: sinon.SinonStub;
    const sandbox = Sinon.createSandbox();
    beforeEach(() => {
        const config: IUpdateStackTaskConfiguration = {
            Type: 'update-stacks',
            StackName: 'stack',
            Template: 'path.yml',
            FilePath: './.',
            LogicalName: 'task',
            MaxConcurrentStacks: 1,
            FailedStackTolerance: 1,
        };
        task = BuildTaskProvider.createBuildTask(config, {} as IPerformTasksCommandArgs, new CfnExpressionResolver());

        updateStacksResources = sandbox.stub(UpdateStacksCommand, 'Perform');
        sandbox.stub(ConsoleUtil, 'LogInfo')
    });

    afterEach(() => {
        sandbox.restore();
    });
    test('creates task', () => {
        expect(task).toBeDefined();
    });

    test('template and stack name are passed to updateStackResources', async () => {
        await task.perform();
        const commandArgs = updateStacksResources.lastCall.args[0] as IUpdateStacksCommandArgs;
        const fileArg = commandArgs.templateFile;
        const commandKeys = Object.keys(commandArgs);

        expect(fileArg.endsWith('path.yml')).toBe(true);
        expect(commandKeys.length).toBe(8);
        expect(commandKeys).toEqual(expect.arrayContaining(['stackName']));
        expect(commandArgs.stackName).toBe('stack');
    });
});

describe('when creating UpdateStacksTask task with command args', () => {
    let task: IBuildTask;
    let updateStacksResources: Sinon.SinonStub;
    const sandbox = Sinon.createSandbox();
    beforeEach(() => {
        const config: IUpdateStackTaskConfiguration = {
            Type: 'update-stacks',
            StackName: 'stack',
            Template: 'path.yml',
            FilePath: './.',
            LogicalName: 'task',
            MaxConcurrentStacks: 1,
            FailedStackTolerance: 1,
        };
        task = BuildTaskProvider.createBuildTask(config, { arg: 'Val' } as any, new CfnExpressionResolver());
        updateStacksResources = sandbox.stub(UpdateStacksCommand, 'Perform');
        sandbox.stub(ConsoleUtil, 'LogInfo');
    });

    afterEach(() => {
        sandbox.restore();
    });

    test('creates task', () => {
        expect(task).toBeDefined();
    });
    test('arguments sent to perform are passed to updateStackResources', async () => {
        await task.perform();
        const commandArgs = updateStacksResources.lastCall.args[0] as IUpdateStacksCommandArgs;
        const fileArg = commandArgs.templateFile;
        const commandKeys = Object.keys(commandArgs);

        expect(fileArg.endsWith('path.yml')).toBe(true);
        expect(commandKeys.length).toBe(9);
        expect(commandKeys).toEqual(expect.arrayContaining(['stackName']));
        expect(commandArgs.stackName).toBe('stack');
        expect(commandKeys).toEqual(expect.arrayContaining(['arg']));
        expect((commandArgs as any).arg).toBe('Val');
        }
    );
});

describe('when creating UpdateStacksTask task with old attribute names', () => {
    let task: IBuildTask;
    let updateStacksResources: sinon.SinonStub;
    const sandbox = Sinon.createSandbox();
    let logWarningStub: Sinon.SinonStub;

    beforeEach(async () => {

        logWarningStub = sandbox.stub(ConsoleUtil, 'LogWarning');

        const config: IUpdateStackTaskConfiguration = {
            FilePath: './.',
            LogicalName: 'task',
            Type: 'update-stacks',
            StackName: 'stack',
            Template: 'path.yml',
            Parameters: { Key: 'Val' },
            OrganizationBinding: {
                IncludeMasterAccount: true,
                AccountsWithTag: 'Bla',
                Account: [{ Ref: 'AccountName' }],
            },
            OrganizationBindingRegion: ['eu-central-1', 'us-west-1'],
            OrganizationBindings: {
                NamedBinding: { Account: [{ Ref: 'AccountName' }] },
            },
            TerminationProtection: false,
            MaxConcurrentStacks: 1,
            FailedStackTolerance: 1,
        };
        task = BuildTaskProvider.createBuildTask(config, { arg: 'Val' } as any, new CfnExpressionResolver());
        updateStacksResources = sandbox.stub(UpdateStacksCommand, 'Perform');
        sandbox.stub(ConsoleUtil, 'LogInfo');
        await task.perform();

    });
    afterEach(() => {
        sandbox.restore();
    });

    test('logs warning for old attribute names', () => {
        expect(logWarningStub.callCount).toBe(2);
    });

    test('all arguments are passed to updateStackResources', () => {
        const commandArgs = updateStacksResources.lastCall.args[0] as IUpdateStacksCommandArgs;
        const fileArg = commandArgs.templateFile;
        const commandKeys = Object.keys(commandArgs);

        expect(fileArg.endsWith('path.yml')).toBe(true);
        expect(commandKeys.length).toBe(13);
        expect(commandKeys).toEqual(expect.arrayContaining(['stackName']));
        expect(commandArgs.stackName).toBe('stack');
        expect(commandKeys).toEqual(expect.arrayContaining(['arg']));
        expect((commandArgs as any).arg).toBe('Val');
        expect(commandArgs.terminationProtection).toBe(false);
        expect(commandArgs.organizationBindings.NamedBinding).toBeDefined();
        expect(commandArgs.defaultOrganizationBinding.IncludeMasterAccount).toBe(true);
        expect(commandArgs.defaultOrganizationBindingRegion[0]).toBe('eu-central-1');
        expect(commandArgs.defaultOrganizationBindingRegion[1]).toBe('us-west-1');
        expect((commandArgs.parameters as any).Key).toBe('Val');
    });
});

describe('when creating UpdateStacksTask task', () => {
    let task: IBuildTask;
    const sandbox = Sinon.createSandbox();
    let updateStacksResources: sinon.SinonStub;

    beforeEach(() => {
        const config: IUpdateStackTaskConfiguration = {
            FilePath: './.',
            LogicalName: 'task',
            Type: 'update-stacks',
            StackName: 'stack',
            Template: 'path.yml',
            Parameters: { Key: 'Val' },
            DefaultOrganizationBinding: {
                IncludeMasterAccount: true,
                AccountsWithTag: 'Bla',
                Account: [{ Ref: 'AccountName' }],
            },
            DefaultOrganizationBindingRegion: ['eu-central-1', 'us-west-1'],
            OrganizationBindings: {
                NamedBinding: { Account: [{ Ref: 'AccountName' }] },
            },
            TerminationProtection: false,
            MaxConcurrentStacks: 1,
            FailedStackTolerance: 1,
        };
        task = BuildTaskProvider.createBuildTask(config, { arg: 'Val' } as any, new CfnExpressionResolver());
        updateStacksResources = sandbox.stub(UpdateStacksCommand, 'Perform');
        sandbox.stub(ConsoleUtil, 'LogInfo');
    });
    afterEach(() => {
        sandbox.restore();
    });

    test('all arguments are passed to updateStackResources', async () => {
        await task.perform();
        const commandArgs = updateStacksResources.lastCall.args[0] as IUpdateStacksCommandArgs;
        const fileArg = commandArgs.templateFile;
        const commandKeys = Object.keys(commandArgs);

        expect(fileArg.endsWith('path.yml')).toBe(true);
        expect(commandKeys.length).toBe(13);
        expect(commandKeys).toEqual(expect.arrayContaining(['stackName']));
        expect(commandArgs.stackName).toBe('stack');
        expect(commandKeys).toEqual(expect.arrayContaining(['arg']));
        expect((commandArgs as any).arg).toBe('Val');
        expect(commandArgs.terminationProtection).toBe(false);
        expect(commandArgs.organizationBindings.NamedBinding).toBeDefined();
        expect(commandArgs.defaultOrganizationBinding.IncludeMasterAccount).toBe(true);
        expect(commandArgs.defaultOrganizationBindingRegion[0]).toBe('eu-central-1');
        expect(commandArgs.defaultOrganizationBindingRegion[1]).toBe('us-west-1');
        expect((commandArgs.parameters as any).Key).toBe('Val');
    });
});
