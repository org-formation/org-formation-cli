import { Command, Option } from 'commander';
import { create } from 'domain';
import Sinon = require('sinon');
import { CfnTaskRunner } from '../../../src/cfn-binder/cfn-task-runner';
import { BaseCliCommand } from '../../../src/commands/base-command';
import { ValidateStacksCommand } from '../../../src/commands/validate-stacks';
import { IUpdateStacksCommandArgs } from '../../../src/commands/update-stacks';
import { GenericTaskRunner } from '../../../src/core/generic-task-runner';
import { FileUtil } from '../../../src/file-util';
import { TemplateRoot } from '../../../src/parser/parser';
import { IState, PersistedState } from '../../../src/state/persisted-state';
import { S3StorageProvider } from '../../../src/state/storage-provider';
import { DefaultTemplate } from '../../../src/writer/default-template-writer';
import { ICfnResource } from '../cfn-types';
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

    test('init command is created', () => {
        expect(command).toBeDefined();
        expect(subCommanderCommand).toBeDefined();
        expect(subCommanderCommand.name()).toBe('validate-stacks');
    });

    test('init command has description', () => {
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

        commandArgs = {...subCommanderCommand, templateFile: 'abc.yml'}  as unknown as IUpdateStacksCommandArgs;

    });

    afterEach(() => {
        sandbox.restore();
    });

    test('calls getState and createTemplate', async () => {
        await command.performCommand(commandArgs);
        expect(getStateStub.callCount).toBe(1);
        expect(createTemplateStub.callCount).toBe(1);
        const args = createTemplateStub.lastCall.args;
        expect(args[0]).toBe('abc.yml');
    });

    test('performs tasks in parallel and continues on errors', async () => {
        await command.performCommand(commandArgs);
        expect(runTaksStub.callCount).toBe(1);

        const args = runTaksStub.lastCall.args;
        const params = args[1];

        expect(params.maxConcurrentTasks).toBe(99);
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
