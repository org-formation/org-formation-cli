import * as chai from 'chai';
import { expect } from 'chai';
import { beforeEach } from 'mocha';
import sinon from 'sinon';
import Sinon from 'sinon';
import { IBuildTask, IUpdateStackTaskConfiguration } from '../../../src/build-tasks/build-configuration';
import { BuildTaskProvider } from '../../../src/build-tasks/build-task-provider';
import { ICommandArgs } from '../../../src/commands/base-command';
import { IUpdateStacksCommandArgs, UpdateStacksCommand } from '../../../src/commands/update-stacks';
import { ConsoleUtil } from '../../../src/console-util';

describe('when creating UpdateStacksTask task', () => {
    let task: IBuildTask;
    let updateStacksResoruces: sinon.SinonStub;
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

        updateStacksResoruces = sinon.stub(UpdateStacksCommand, 'Perform');
    });

    afterEach(() => {
        updateStacksResoruces.restore();
    });
    it('creates task', () => {
        expect(task).to.not.be.undefined;
    });

    it('template and stackname are passed to updateStackResources', async () => {
        await task.perform();
        const commandArgs = updateStacksResoruces.lastCall.args[0] as IUpdateStacksCommandArgs;
        const fileArg = commandArgs.templateFile;
        const commandKeys = Object.keys(commandArgs);

        expect(fileArg.endsWith('path.yml')).to.be.true;
        expect(commandKeys.length).to.eq(2);
        expect(commandKeys).contains('stackName');
        expect(commandArgs.stackName).to.eq('stack');
    });
});

describe('when creating UpdateStacksTask task with command args', () => {
    let task: IBuildTask;
    let updateStacksResoruces: sinon.SinonStub;
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
        updateStacksResoruces = sinon.stub(UpdateStacksCommand, 'Perform');
    });

    afterEach(() => {
        updateStacksResoruces.restore();
    });

    it('creates task', () => {
        expect(task).to.not.be.undefined;
    });
    it('arguments sent to perform are passed to updateStackResources', async () => {
        await task.perform();
        const commandArgs = updateStacksResoruces.lastCall.args[0] as IUpdateStacksCommandArgs;
        const fileArg = commandArgs.templateFile;
        const commandKeys = Object.keys(commandArgs);

        expect(fileArg.endsWith('path.yml')).to.be.true;
        expect(commandKeys.length).to.eq(3);
        expect(commandKeys).contains('stackName');
        expect(commandArgs.stackName).to.eq('stack');
        expect(commandKeys).contains('arg');
        expect((commandArgs as any).arg).to.eq('Val');
    });
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
        await task.perform();

    });
    afterEach(() => {
        sandbox.restore();
    });

    it('logs warning for old attribute names', () => {
        expect(logWarningStub.callCount).to.eq(2);
    });

    it('all arguments are passed to updateStackResources', () => {
        const commandArgs = updateStacksResoruces.lastCall.args[0] as IUpdateStacksCommandArgs;
        const fileArg = commandArgs.templateFile;
        const commandKeys = Object.keys(commandArgs);

        expect(fileArg.endsWith('path.yml')).to.be.true;
        expect(commandKeys.length).to.eq(8);
        expect(commandKeys).contains('stackName');
        expect(commandArgs.stackName).to.eq('stack');
        expect(commandKeys).contains('arg');
        expect((commandArgs as any).arg).to.eq('Val');
        expect(commandArgs.terminationProtection).to.eq(false);
        expect(commandArgs.organizationBindings.NamedBinding).to.not.be.undefined;
        expect(commandArgs.defaultOrganizationBinding.IncludeMasterAccount).to.eq(true);
        expect(commandArgs.defaultOrganizationBindingRegion[0]).to.eq('eu-central-1');
        expect(commandArgs.defaultOrganizationBindingRegion[1]).to.eq('us-west-1');
        expect((commandArgs.parameters as any).Key).to.eq('Val');
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
    });
    afterEach(() => {
        sandbox.restore();
    });

    it('all arguments are passed to updateStackResources', async () => {
        await task.perform();
        const commandArgs = updateStacksResoruces.lastCall.args[0] as IUpdateStacksCommandArgs;
        const fileArg = commandArgs.templateFile;
        const commandKeys = Object.keys(commandArgs);

        expect(fileArg.endsWith('path.yml')).to.be.true;
        expect(commandKeys.length).to.eq(8);
        expect(commandKeys).contains('stackName');
        expect(commandArgs.stackName).to.eq('stack');
        expect(commandKeys).contains('arg');
        expect((commandArgs as any).arg).to.eq('Val');
        expect(commandArgs.terminationProtection).to.eq(false);
        expect(commandArgs.organizationBindings.NamedBinding).to.not.be.undefined;
        expect(commandArgs.defaultOrganizationBinding.IncludeMasterAccount).to.eq(true);
        expect(commandArgs.defaultOrganizationBindingRegion[0]).to.eq('eu-central-1');
        expect(commandArgs.defaultOrganizationBindingRegion[1]).to.eq('us-west-1');
        expect((commandArgs.parameters as any).Key).to.eq('Val');
    });
});
