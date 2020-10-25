import { PrintStacksCommand, IPrintStacksCommandArgs } from "~commands/print-stacks";
import { Command, Option } from "commander";
import { DescribeStacksCommand, IDescribeStackCommandArgs } from "~commands/describe-stacks";
import { ConsoleUtil } from "~util/console-util";
import Sinon = require("sinon");
import { AwsUtil } from "~util/aws-util";
import { TemplateRoot } from "~parser/parser";
import { PersistedState } from "~state/persisted-state";
import { S3StorageProvider } from "~state/storage-provider";
import { CloudFormationBinder, ICfnBinding } from "~cfn-binder/cfn-binder";
import { CfnTemplate } from "~cfn-binder/cfn-template";
import { GlobalState } from "~util/global-state";

describe('when creating print stacks command', () => {
    let command: PrintStacksCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;

    beforeEach(() => {
        commanderCommand = new Command('root');
        command = new PrintStacksCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];
    });

    test('print stacks command is created', () => {
        expect(command).toBeDefined();
        expect(subCommanderCommand).toBeDefined();
        expect(subCommanderCommand.name()).toBe('print-stacks');
    });

    test('print stacks command has description', () => {
       expect(subCommanderCommand).toBeDefined();
       expect(subCommanderCommand.description()).toBeDefined();
    });

    test('command has required stack name parameter without', () => {
        const opts: Option[] = subCommanderCommand.options;
        const stackNameOpt = opts.find((x) => x.long === '--stack-name');
        expect(stackNameOpt).toBeDefined();
        expect(stackNameOpt.required).toBeTruthy();
    });

    test('command has required output path parameter with default', () => {
        const opts: Option[] = subCommanderCommand.options;
        const stackNameOpt = opts.find((x) => x.long === '--output-path');
        expect(stackNameOpt).toBeDefined();
        expect(stackNameOpt.required).toBeFalsy();
        expect(subCommanderCommand.outputPath).toBe(undefined);
    });

    test('command has required output parameter with default', () => {
        const opts: Option[] = subCommanderCommand.options;
        const stackNameOpt = opts.find((x) => x.long === '--output');
        expect(stackNameOpt).toBeDefined();
        expect(stackNameOpt.required).toBeTruthy();
        expect(subCommanderCommand.output).toBe('yaml');
    });

    test('command has required output parameter with default', () => {
        const opts: Option[] = subCommanderCommand.options;
        const stackNameOpt = opts.find((x) => x.long === '--output-cross-account-exports');
        expect(stackNameOpt).toBeDefined();
        expect(stackNameOpt.required).toBeTruthy();
        expect(subCommanderCommand.outputCrossAccountExports).toBe(false);
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

    test('command has organization file parameter which is optional', () => {
        const opts: Option[] = subCommanderCommand.options;
        const stateObjectOpt = opts.find((x) => x.long === '--organization-file');
        expect(stateObjectOpt).toBeDefined();
    });
});


describe('when executing print-stacks command', () => {
    let command: PrintStacksCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;
    let createTemplate: Sinon.SinonStub;
    let enumBindings: Sinon.SinonStub;
    let storageProviderGet: Sinon.SinonStub;
    const sandbox = Sinon.createSandbox();
    let commandArgs: IPrintStacksCommandArgs;
    let consoleOut: Sinon.SinonStub;

    beforeEach(() => {
        consoleOut = sandbox.stub(ConsoleUtil, 'Out');

        commanderCommand = new Command('root');
        command = new PrintStacksCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];

        sandbox.stub(AwsUtil, 'GetMasterAccountId').returns(Promise.resolve('123456789012'));

        const template = TemplateRoot.create('./test/resources/cloudformation-template.yml', {
            OrganizationFile:  './test/resources/valid-basic.yml',
            DefaultOrganizationBinding: { Account: '*', Region: 'eu-central-1'}
        });

        const emptyState = PersistedState.CreateEmpty('123456789012');
        createTemplate = sandbox.stub(TemplateRoot, 'create');
        createTemplate.returns(template);

        storageProviderGet = sandbox.stub(S3StorageProvider.prototype, 'get');
        storageProviderGet.returns(emptyState.toJson());

        enumBindings = sandbox.stub(CloudFormationBinder.prototype, 'enumBindings');
        enumBindings.returns([{
            accountId: '123123123123',
            region: 'eu-central-1',
            stackName: 'stackName',
            action: 'UpdateOrCreate',
            templateHash: '132123',
            template: new CfnTemplate({accountLogicalId: 'Account1', region: 'eu-central-1', resources: []}, template, emptyState),
            dependencies: [],
            dependents: [],
            accountDependencies: [],
            regionDependencies: [],
        } as ICfnBinding]);

        commandArgs = {
            ...subCommanderCommand,
            stackName: 'myStackName',
            templateFile: 'template.yml',
            output: 'json'
        } as unknown as IPrintStacksCommandArgs;
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

    test('console out prints name and target', async () => {
        await command.performCommand(commandArgs);
        expect(consoleOut.callCount).toBe(2);
        expect(consoleOut.getCall(0).args[0]).toContain('123123123123');
        expect(consoleOut.getCall(0).args[0]).toContain('eu-central-1');
    });

    test('console out prints processed template', async () => {
        await command.performCommand(commandArgs);
        expect(consoleOut.callCount).toBe(2);
        expect(consoleOut.getCall(1).args[0]).toBeDefined();
        const output = consoleOut.getCall(1).args[0];
        expect(JSON.parse(output)).toBeDefined();
    });
});