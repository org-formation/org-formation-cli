import { Command, Option } from 'commander';
import Sinon from 'sinon';
import { BaseCliCommand } from '~commands/base-command';
import { DescribeStacksCommand, IDescribeStackCommandArgs } from '~commands/describe-stacks';
import { ConsoleUtil } from '~util/console-util';
import { PersistedState } from '~state/persisted-state';

describe('when creating describe stacks command', () => {
    let command: DescribeStacksCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;

    beforeEach(() => {
        commanderCommand = new Command('root');
        command = new DescribeStacksCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];
    });

    test('describe-stacks command is created', () => {
        expect(command).toBeDefined();
        expect(subCommanderCommand).toBeDefined();
        expect(subCommanderCommand.name()).toBe('describe-stacks');
    });

    test('describe-stacks command has description', () => {
       expect(subCommanderCommand).toBeDefined();
       expect(subCommanderCommand.description()).toBeDefined();
    });

    test('command has state bucket parameter with correct default', () => {
        const opts: Option[] = subCommanderCommand.options;
        const stateBucketOpt = opts.find((x) => x.long === '--state-bucket-name');
        expect(stateBucketOpt).toBeDefined();
        expect(subCommanderCommand.stateBucketName).toBe('organization-formation-${AWS::AccountId}');
    });

    test('command has stack name parameter which is optional', () => {
        const opts: Option[] = subCommanderCommand.options;
        const stackNameOpt = opts.find((x) => x.long === '--stack-name');
        expect(stackNameOpt).toBeDefined();
        expect(stackNameOpt.required).toBeFalsy();
    });
});


describe('when executing describe stacks command', () => {
    let command: DescribeStacksCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;
    let getStateStub: Sinon.SinonStub;
    let commandArgs: IDescribeStackCommandArgs;
    let consoleOut: Sinon.SinonStub;
    const sandbox = Sinon.createSandbox();

    beforeEach(() => {
        consoleOut = sandbox.stub(ConsoleUtil, 'Out');

        commanderCommand = new Command('root');
        command = new DescribeStacksCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];

        const state = PersistedState.CreateEmpty('123456789012');
        state.setTarget({
            lastCommittedHash: 'aa',
            logicalAccountId: 'Account1',
            stackName: 'stack',
            region: 'eu-central-1',
            accountId: '111111111111'
        });

        state.setTarget({
            lastCommittedHash: 'aa',
            logicalAccountId: 'Account1',
            stackName: 'stack2',
            region: 'eu-central-1',
            accountId: '111111111111'
        });

        getStateStub = sandbox.stub(BaseCliCommand.prototype, 'getState');
        getStateStub.returns(state);

        commandArgs = {
            ...subCommanderCommand,
            stackName: 'stack'
        } as unknown as IDescribeStackCommandArgs;
    });

    afterEach(() => {
        sandbox.restore();
    });


    test('calls getState to get stacks', async () => {
        await command.performCommand(commandArgs);
        expect(getStateStub.callCount).toBe(1);
    });

    test('writes output to console', async () => {
        await command.performCommand(commandArgs);
        expect(consoleOut.callCount).toBe(1);
        const output: string = consoleOut.getCall(0).args[0];
        expect(typeof output).toBe('string');
        const outpuObject = JSON.parse(output);
        expect(outpuObject.stack).toBeDefined();
        expect(Array.isArray(outpuObject.stack)).toBeDefined();
    });


    describe('and not stackname was provided', () => {
        beforeEach(() => {
            commandArgs.stackName = undefined;
        });

        afterEach(() => {
            sandbox.restore();
        });


        test('all stacks are writted to console', async () => {
            await command.performCommand(commandArgs);
            expect(consoleOut.callCount).toBe(1);
            const output: string = consoleOut.getCall(0).args[0];
            expect(typeof output).toBe('string');
            const outpuObject = JSON.parse(output);
            expect(outpuObject.stack).toBeDefined();
            expect(Array.isArray(outpuObject.stack)).toBeDefined();
            expect(outpuObject.stack2).toBeDefined();
            expect(Array.isArray(outpuObject.stack2)).toBeDefined();
        });
    });
});