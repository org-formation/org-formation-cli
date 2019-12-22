import * as chai from 'chai';
import { expect } from 'chai';
import { beforeEach } from 'mocha';
import sinon from 'sinon';
import { IBuildTask, IUpdateStackTaskConfiguration } from '../../../src/build-tasks/build-configuration';
import { BuildTaskProvider } from '../../../src/build-tasks/build-task-provider';
import { ICommandArgs } from '../../../src/commands/base-command';
import { IUpdateStacksCommandArgs, UpdateStacksCommand } from '../../../src/commands/update-stacks';

describe('when creating UpdateStacksTask task', () => {
    let task: IBuildTask;
    let updateStacksResoruces: sinon.SinonStub;
    beforeEach(() => {
        const config: IUpdateStackTaskConfiguration = {Type: 'update-stacks', StackName: 'stack', Template: 'path.yml', FilePath: './.', LogicalName: 'task'};
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
        const commandArgs = updateStacksResoruces.lastCall.args[0]  as IUpdateStacksCommandArgs;
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
        const config: IUpdateStackTaskConfiguration = {Type: 'update-stacks', StackName: 'stack', Template: 'path.yml', FilePath: './.', LogicalName: 'task'};
        task = BuildTaskProvider.createBuildTask(config, {arg: 'Val'} as any);
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
        const commandArgs = updateStacksResoruces.lastCall.args[0]  as IUpdateStacksCommandArgs;
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
describe('when creating UpdateStacksTask task with arguments', () => {
    let task: IBuildTask;
    let updateStacksResoruces: sinon.SinonStub;
    beforeEach(() => {
        const config: IUpdateStackTaskConfiguration = {
            FilePath: './.',
            LogicalName: 'task',
            Type: 'update-stacks',
            StackName: 'stack',
            Template: 'path.yml',
            Parameters: {Key: 'Val'},
            OrganizationBinding: {
                IncludeMasterAccount: true,
                AccountsWithTag: 'Bla',
                Account: [{Ref: 'AccountName'}],
            },
            OrganizationBindingRegion:  ['eu-central-1', 'us-west-1'],
            TerminationProtection: false,
         };
        task = BuildTaskProvider.createBuildTask(config, {arg: 'Val'} as any);
        updateStacksResoruces = sinon.stub(UpdateStacksCommand, 'Perform');
    });

    it('all arguments are passed to updateStackResources', async () => {
        await task.perform();
        const commandArgs = updateStacksResoruces.lastCall.args[0]  as IUpdateStacksCommandArgs;
        const fileArg = commandArgs.templateFile;
        const commandKeys = Object.keys(commandArgs);

        expect(fileArg.endsWith('path.yml')).to.be.true;
        expect(commandKeys.length).to.eq(7);
        expect(commandKeys).contains('stackName');
        expect(commandArgs.stackName).to.eq('stack');
        expect(commandKeys).contains('arg');
        expect((commandArgs as any).arg).to.eq('Val');
        expect(commandArgs.terminationProtection).to.eq(false);
        expect(commandArgs.organizationBinding.IncludeMasterAccount).to.eq(true);
        expect(commandArgs.organizationBindingRegion[0]).to.eq('eu-central-1');
        expect(commandArgs.organizationBindingRegion[1]).to.eq('us-west-1');
        expect((commandArgs.parameters as any).Key).to.eq('Val');
    });
});
