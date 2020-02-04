import { expect } from 'chai';
import { Command, Option } from 'commander';
import Sinon = require('sinon');
import { BaseCliCommand } from '../../../src/commands/base-command';
import { IUpdateStacksCommandArgs } from '../../../src/commands/update-stacks';
import { ValidateStacksCommand } from '../../../src/commands/validate-stacks';
import { GenericTaskRunner } from '../../../src/core/generic-task-runner';
import { TemplateRoot } from '../../../src/parser/parser';
import { TestTemplates } from '../test-templates';

describe('when creating validate stacks command', () => {
    let command: ValidateStacksCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;

    beforeEach(() => {
        commanderCommand = new Command('root');
        command = new ValidateStacksCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];
    });

    it('init command is created', () => {
        expect(command).to.not.be.undefined;
        expect(subCommanderCommand).to.not.be.undefined;
        expect(subCommanderCommand.name()).to.eq('validate-stacks');
    });

    it('init command has description', () => {
       expect(subCommanderCommand).to.not.be.undefined;
       expect(subCommanderCommand.description()).to.not.be.undefined;
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
});

describe('when validate stacks command', () => {
    let command: ValidateStacksCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;
    let runTaksStub: Sinon.SinonStub;
    let getStateStub: Sinon.SinonStub;
    let createTemplateStub: Sinon.SinonStub;
    let commandArgs: IUpdateStacksCommandArgs;
    let testTemplate: TemplateRoot;
    const sandbox = Sinon.createSandbox();

    beforeEach(() => {
        const resource = {
            Type: 'AWS::S3::Bucket',
            OrganizationBinding: {
                Account: '*',
                IncludeMasterAccount: true,
                Region: ['eu-west-1', 'us-east-1'],
            },
            ForeachAccount: {
                Account: '*',
            },
            Properties: {
                BucketName: 'hello',
            },
        };
        testTemplate = TestTemplates.createBasicTemplate({resource});
        const testState = TestTemplates.createState(testTemplate);

        getStateStub = sandbox.stub(BaseCliCommand.prototype, 'getState');
        getStateStub.returns(testState);

        createTemplateStub = sandbox.stub(TemplateRoot, 'create');
        createTemplateStub.returns(testTemplate);

        runTaksStub = sandbox.stub(GenericTaskRunner, 'RunTasks');

        commanderCommand = new Command('root');
        command = new ValidateStacksCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];

        commandArgs = {...subCommanderCommand, templateFile: 'abc.yml'} as unknown as IUpdateStacksCommandArgs;

    });

    afterEach(() => {
        sandbox.restore();
    });

    it('calls getState and createTemplate', async () => {
        await command.performCommand(commandArgs);
        expect(getStateStub.callCount).to.eq(1);
        expect(createTemplateStub.callCount).to.eq(1);
        const args = createTemplateStub.lastCall.args;
        expect(args[0]).to.eq('abc.yml');
    });

    it('performs tasks in parallel and continues on errors', async () => {
        await command.performCommand(commandArgs);
        expect(runTaksStub.callCount).to.eq(1);

        const args = runTaksStub.lastCall.args;
        const params = args[1];

        expect(params.maxConcurrentTasks).to.eq(99);
        expect(params.failedTasksTolerance).to.eq(99);
    });

    it('validates all template targets', async () => {
        await command.performCommand(commandArgs);
        expect(runTaksStub.callCount).to.eq(1);

        const args = runTaksStub.lastCall.args;
        const tasks: [] = args[0];

        expect(tasks.length).to.eq(6);
    });
});
