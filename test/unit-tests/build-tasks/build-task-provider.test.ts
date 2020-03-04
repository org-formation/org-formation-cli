import Sinon from 'sinon';
import { IBuildTask, IUpdateStackTaskConfiguration } from '~build-tasks/build-configuration';
import { BuildTaskProvider } from '~build-tasks/build-task-provider';
import { ICommandArgs } from '~commands/base-command';
import { IUpdateStacksCommandArgs, UpdateStacksCommand } from '~commands/update-stacks';
import { ConsoleUtil } from '../../../src/console-util';

describe('when creating UpdateStacksTask task', () => {
    let task: IBuildTask;
    let updateStacksResoruces: sinon.SinonStub;
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
        task = BuildTaskProvider.createBuildTask(config, {} as ICommandArgs);

        updateStacksResoruces = sandbox.stub(UpdateStacksCommand, 'Perform');
        sandbox.stub(ConsoleUtil, 'LogInfo')
    });

    afterEach(() => {
        sandbox.restore();
    });
    test('creates task', () => {
        expect(task).toBeDefined();
    });

    test('template and stackname are passed to updateStackResources', async () => {
        await task.perform();
        const commandArgs = updateStacksResoruces.lastCall.args[0] as IUpdateStacksCommandArgs;
        const fileArg = commandArgs.templateFile;
        const commandKeys = Object.keys(commandArgs);

        expect(fileArg.endsWith('path.yml')).toBe(true);
        expect(commandKeys.length).toBe(4);
        expect(commandKeys).toEqual(expect.arrayContaining(['stackName']));
        expect(commandArgs.stackName).toBe('stack');
    });
});

describe('when creating UpdateStacksTask task with command args', () => {
    let task: IBuildTask;
    let updateStacksResoruces: Sinon.SinonStub;
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
        task = BuildTaskProvider.createBuildTask(config, { arg: 'Val' } as any);
        updateStacksResoruces = sandbox.stub(UpdateStacksCommand, 'Perform');
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
            const commandArgs = updateStacksResoruces.lastCall.args[0] as IUpdateStacksCommandArgs;
            const fileArg = commandArgs.templateFile;
            const commandKeys = Object.keys(commandArgs);

            expect(fileArg.endsWith('path.yml')).toBe(true);
            expect(commandKeys.length).toBe(5);
            expect(commandKeys).toEqual(expect.arrayContaining(['stackName']));
            expect(commandArgs.stackName).toBe('stack');
            expect(commandKeys).toEqual(expect.arrayContaining(['arg']));
            expect((commandArgs as any).arg).toBe('Val');
        }
    );
});

describe('when creating UpdateStacksTask task with old attribute names', () => {
    let task: IBuildTask;
    let updateStacksResoruces: sinon.SinonStub;
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
        task = BuildTaskProvider.createBuildTask(config, { arg: 'Val' } as any);
        updateStacksResoruces = sandbox.stub(UpdateStacksCommand, 'Perform');
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
        const commandArgs = updateStacksResoruces.lastCall.args[0] as IUpdateStacksCommandArgs;
        const fileArg = commandArgs.templateFile;
        const commandKeys = Object.keys(commandArgs);

        expect(fileArg.endsWith('path.yml')).toBe(true);
        expect(commandKeys.length).toBe(10);
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
    let updateStacksResoruces: sinon.SinonStub;

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
        task = BuildTaskProvider.createBuildTask(config, { arg: 'Val' } as any);
        updateStacksResoruces = sandbox.stub(UpdateStacksCommand, 'Perform');
        sandbox.stub(ConsoleUtil, 'LogInfo');
    });
    afterEach(() => {
        sandbox.restore();
    });

    test('all arguments are passed to updateStackResources', async () => {
        await task.perform();
        const commandArgs = updateStacksResoruces.lastCall.args[0] as IUpdateStacksCommandArgs;
        const fileArg = commandArgs.templateFile;
        const commandKeys = Object.keys(commandArgs);

        expect(fileArg.endsWith('path.yml')).toBe(true);
        expect(commandKeys.length).toBe(10);
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
