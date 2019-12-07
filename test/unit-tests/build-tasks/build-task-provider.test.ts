import * as chai from 'chai';
import { expect } from 'chai';
import { beforeEach } from 'mocha';
import sinon from 'sinon';
import * as All from '../../../';
import { IBuildTask, IConfiguratedUpdateStackBuildTask } from '../../../src/build-tasks/build-configuration';
import { BuildTaskProvider } from '../../../src/build-tasks/build-task-provider';

describe('when creating UpdateStacksTask task', () => {
    let task: IBuildTask;
    let updateStacksResoruces: sinon.SinonStub;
    beforeEach(() => {
        const config: IConfiguratedUpdateStackBuildTask = {Type: 'update-stacks', StackName: 'stack', Template: 'path.yml'};
        task = BuildTaskProvider.createBuildTask('./.', 'task', config);
        updateStacksResoruces = sinon.stub(All, 'updateAccountResources');
    });

    afterEach(() => {
        updateStacksResoruces.restore();
    });

    it('creates task', () => {
        expect(task).to.not.be.undefined;
    });

    it('template and stackname are passed to updateStackResources', async () => {
        await task.perform({});
        const fileArg: string = updateStacksResoruces.lastCall.args[0];
        const commandArgs = updateStacksResoruces.lastCall.args[1];
        const commandKeys = Object.keys(commandArgs);

        expect(fileArg.endsWith('path.yml')).to.be.true;
        expect(commandKeys.length).to.eq(1);
        expect(commandKeys).contains('stackName');
        expect(commandArgs.stackName).to.eq('stack');
    });

    it('arguments sent to perform are passed to updateStackResources', async () => {
        await task.perform({arg: 'Val'});
        const fileArg: string = updateStacksResoruces.lastCall.args[0];
        const commandArgs = updateStacksResoruces.lastCall.args[1];
        const commandKeys = Object.keys(commandArgs);

        expect(fileArg.endsWith('path.yml')).to.be.true;
        expect(commandKeys.length).to.eq(2);
        expect(commandKeys).contains('stackName');
        expect(commandArgs.stackName).to.eq('stack');
        expect(commandKeys).contains('arg');
        expect(commandArgs.arg).to.eq('Val');
    });
});

describe('when creating UpdateStacksTask task with arguments', () => {
    let task: IBuildTask;
    let updateStacksResoruces: sinon.SinonStub;
    beforeEach(() => {
        const config: IConfiguratedUpdateStackBuildTask = {
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
        task = BuildTaskProvider.createBuildTask('./.', 'task', config);
        updateStacksResoruces = sinon.stub(All, 'updateAccountResources');
    });

    it('all arguments are passed to updateStackResources', async () => {
        await task.perform({arg: 'Val'});
        const fileArg: string = updateStacksResoruces.lastCall.args[0];
        const commandArgs = updateStacksResoruces.lastCall.args[1];
        const commandKeys = Object.keys(commandArgs);

        expect(fileArg.endsWith('path.yml')).to.be.true;
        expect(commandKeys.length).to.eq(6);
        expect(commandKeys).contains('stackName');
        expect(commandArgs.stackName).to.eq('stack');
        expect(commandKeys).contains('arg');
        expect(commandArgs.arg).to.eq('Val');
        expect(commandArgs.terminationProtection).to.eq(false);
        expect(commandArgs.organizationBinding.IncludeMasterAccount).to.eq(true);
        expect(commandArgs.organizationBindingRegion[0]).to.eq('eu-central-1');
        expect(commandArgs.organizationBindingRegion[1]).to.eq('us-west-1');
        expect(commandArgs.parameters.Key).to.eq('Val');
    });
});
