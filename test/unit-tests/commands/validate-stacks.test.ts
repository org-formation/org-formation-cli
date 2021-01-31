import { Command, Option } from 'commander';
import Sinon from 'sinon';
import { BaseCliCommand } from '~commands/base-command';
import { IUpdateStacksCommandArgs } from '~commands/update-stacks';
import { ValidateStacksCommand } from '~commands/validate-stacks';
import { GenericTaskRunner } from '~core/generic-task-runner';
import { TemplateRoot } from '~parser/parser';
import { TestTemplates } from '../test-templates';
import { ConsoleUtil } from '~util/console-util';
import { GlobalState } from '~util/global-state';

describe('when creating validate stacks command', () => {
    let command: ValidateStacksCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;

    beforeEach(() => {
        commanderCommand = new Command('root');
        command = new ValidateStacksCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];
    });

    test('validate-stacks command is created', () => {
        expect(command).toBeDefined();
        expect(subCommanderCommand).toBeDefined();
        expect(subCommanderCommand.name()).toBe('validate-stacks');
    });

    test('validate-stacks command has description', () => {
       expect(subCommanderCommand).toBeDefined();
       expect(subCommanderCommand.description()).toBeDefined();
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

        commandArgs = {...subCommanderCommand, templateFile: 'abc.yml' } as unknown as IUpdateStacksCommandArgs;

        sandbox.stub(ConsoleUtil, 'LogInfo');
    });

    afterEach(() => {
        sandbox.restore();
    });

    test('global state is set', async () => {
        await command.performCommand(commandArgs);
        expect(GlobalState.State).toBeDefined();
        expect(GlobalState.OrganizationTemplate).toBeDefined();
    });

    test('calls getState and createTemplate', async () => {
        await command.performCommand(commandArgs);
        expect(getStateStub.callCount).toBe(1);
        expect(createTemplateStub.callCount).toBe(1);
        const args = createTemplateStub.lastCall.args;
        expect(args[0]).toBe('abc.yml');
    });

    test('concurrent tasks and failure tolerance have sensible defaults', async () => {
        await command.performCommand(commandArgs);
        expect(runTaksStub.callCount).toBe(1);

        const args = runTaksStub.lastCall.args;
        const params = args[1];

        expect(params.maxConcurrentTasks).toBe(1);
        expect(params.failedTasksTolerance).toBe(99);
    });

    test('validates all template targets', async () => {
        await command.performCommand(commandArgs);
        expect(runTaksStub.callCount).toBe(1);

        const args = runTaksStub.lastCall.args;
        const tasks: [] = args[0];

        expect(tasks.length).toBe(6);
    });
});


describe('when calling static perform method', () => {
    let performCommand: Sinon.SinonStub;
    let commandArgs: IUpdateStacksCommandArgs;
    const sandbox = Sinon.createSandbox();

    beforeEach(() => {
        performCommand = sandbox.stub(ValidateStacksCommand.prototype, 'performCommand');
        commandArgs = { templateFile: 'abc.yml'} as unknown as IUpdateStacksCommandArgs;
    });

    afterEach(() => {
        sandbox.restore();
    });

    test('static perform passes args to perform', async () => {
        await ValidateStacksCommand.Perform(commandArgs);
        expect(performCommand.callCount).toBe(1);
        expect(performCommand.getCall(0).args[0]).toBe(commandArgs);
    });

});