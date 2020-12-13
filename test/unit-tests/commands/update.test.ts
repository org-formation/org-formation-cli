import { UpdateOrganizationCommand, IUpdateOrganizationCommandArgs } from "~commands/update-organization";
import { Command, Option } from 'commander';
import Sinon = require("sinon");
import { ConsoleUtil } from "~util/console-util";
import { AwsUtil } from "~util/aws-util";
import { TemplateRoot } from "~parser/parser";
import { PersistedState } from "~state/persisted-state";
import { S3StorageProvider } from "~state/storage-provider";
import { OrganizationBinder } from "~org-binder/org-binder";
import { IBuildTask } from "~org-binder/org-tasks-provider";
import { TaskRunner } from "~org-binder/org-task-runner";
import { OrgResourceTypes } from "~parser/model/resource-types";
import { AwsOrganization } from "~aws-provider/aws-organization";
import { GlobalState } from "~util/global-state";

describe('when creating update command', () => {
    let command: UpdateOrganizationCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;

    beforeEach(() => {
        commanderCommand = new Command('root');
        command = new UpdateOrganizationCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];
    });

    test('update command is created', () => {
        expect(command).toBeDefined();
        expect(subCommanderCommand).toBeDefined();
        expect(subCommanderCommand.name()).toBe('update');
    });

    test('update command has description', () => {
       expect(subCommanderCommand).toBeDefined();
       expect(subCommanderCommand.description()).toBeDefined();
    });

    test('update command has templateFile as first argument', () => {
        const firstArg = subCommanderCommand._args[0];
        expect(firstArg).toBeDefined();
        expect(firstArg.required).toBe(true);
        expect(firstArg.name).toBe('templateFile');
    });
});



describe('when executing update command', () => {
    let command: UpdateOrganizationCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;
    let createTemplate: Sinon.SinonStub;
    let enumTasks: Sinon.SinonStub;
    let saveState: Sinon.SinonStub;
    let runTasks: Sinon.SinonSpy;
    let storageProviderGet: Sinon.SinonStub;
    const sandbox = Sinon.createSandbox();
    let commandArgs: IUpdateOrganizationCommandArgs;
    let consoleOut: Sinon.SinonStub;
    let consoleInfo: Sinon.SinonStub;
    let consoleError: Sinon.SinonStub;
    let putTemplateHash: Sinon.SinonSpy;
    let getTemplateHash: Sinon.SinonStub;
    let templateHash: string;

    beforeEach(() => {
        consoleOut = sandbox.stub(ConsoleUtil, 'Out');
        consoleInfo = sandbox.stub(ConsoleUtil, 'LogInfo');
        consoleError = sandbox.stub(ConsoleUtil, 'LogError');

        commanderCommand = new Command('root');
        command = new UpdateOrganizationCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];

        sandbox.stub(AwsUtil, 'GetMasterAccountId').returns(Promise.resolve('123456789012'));
        sandbox.stub(AwsUtil, 'GetBuildProcessAccountId').returns(Promise.resolve('123456789012'));


        const template = TemplateRoot.create('./test/resources/valid-basic.yml');
        templateHash = template.hash;

        const emptyState = PersistedState.CreateEmpty('123456789012');
        createTemplate = sandbox.stub(TemplateRoot, 'create');
        createTemplate.returns(template);

        saveState = sandbox.stub(PersistedState.prototype, 'save');
        storageProviderGet = sandbox.stub(S3StorageProvider.prototype, 'get');
        storageProviderGet.returns(emptyState.toJson());

        enumTasks = sandbox.stub(OrganizationBinder.prototype, 'enumBuildTasks');
        enumTasks.returns([{
            type: OrgResourceTypes.Account,
            logicalId: 'NewAccount',
            action: 'Create',
            result: '111111111111',
            perform: (task: IBuildTask) => {},
        } as IBuildTask]);

        runTasks = sandbox.spy(TaskRunner, 'RunTasks');
        putTemplateHash = sandbox.spy(PersistedState.prototype, 'putTemplateHash');
        getTemplateHash = sandbox.stub(PersistedState.prototype, 'getTemplateHash');
        getTemplateHash('xxyyzz');

        sandbox.stub(AwsOrganization.prototype, 'initialize');

        commandArgs = {
            ...subCommanderCommand,
            templateFile: 'template.yml'
        } as unknown as IUpdateOrganizationCommandArgs;
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

    test('enum tasks is called to get tasks', async () => {
        await command.performCommand(commandArgs);
        expect(enumTasks.callCount).toBe(1);
    });

    test('task runner has ran', async () => {
        await command.performCommand(commandArgs);
        expect(runTasks.callCount).toBe(1);
        expect(Array.isArray(runTasks.getCall(0).args[0])).toBeTruthy();
    });

    test('state is saved', async () => {
        await command.performCommand(commandArgs);
        expect(saveState.callCount).toBe(1);
    });

    test('create is logged to console', async () => {
        await command.performCommand(commandArgs);
        expect(consoleOut.callCount).toBe(1);
        expect(consoleOut.lastCall.args[0]).toContain('OC::ORG::Account');
        expect(consoleOut.lastCall.args[0]).toContain('NewAccount');
        expect(consoleOut.lastCall.args[0]).toContain('111111111111');
    });

    test('done is logged to console', async () => {
        await command.performCommand(commandArgs);
        expect(consoleInfo.callCount).toBe(1);
        expect(consoleInfo.lastCall.args[0]).toContain('done');
    });

    test('no error is logged', async () => {
        await command.performCommand(commandArgs);
        expect(consoleError.callCount).toBe(0);
    });

    test('template hash is put', async () => {
        await command.performCommand(commandArgs);
        expect(putTemplateHash.callCount).toBe(1);
        expect(putTemplateHash.lastCall.args[0]).toBe(templateHash);
    });

    test('template hash is gotten', async () => {
        await command.performCommand(commandArgs);
        expect(putTemplateHash.callCount).toBe(1);
    });


    describe('and template has not been changed', () => {
        beforeEach(() => {
            getTemplateHash.returns(templateHash);
        });

        afterEach(() => {
            sandbox.restore();
        })

        test('template hash is not put', async () => {
            await command.performCommand(commandArgs);
            expect(putTemplateHash.callCount).toBe(0);
        });

        test('enum tasks is not called to get tasks', async () => {
            await command.performCommand(commandArgs);
            expect(enumTasks.callCount).toBe(0);
        });

        test('task runner has not ran', async () => {
            await command.performCommand(commandArgs);
            expect(runTasks.callCount).toBe(0);
        });

        test('state is not saved', async () => {
            await command.performCommand(commandArgs);
            expect(saveState.callCount).toBe(0);
        });

        test('up to date is logged to console', async () => {
            await command.performCommand(commandArgs);
            expect(consoleInfo.callCount).toBe(1);
            expect(consoleInfo.firstCall.args[0]).toContain('up to date');
        });

    });

    describe('and task throws', () => {
        beforeEach(() => {
            enumTasks.returns([{
                type: OrgResourceTypes.Account,
                logicalId: 'NewAccount',
                action: 'Create',
                result: '111111111111',
                perform: (task: IBuildTask) => {throw new Error('test error')},
            } as IBuildTask]);
        });

        afterEach(() => {
            sandbox.restore();
        });

        test('template hash is not put', async () => {
            try { await command.performCommand(commandArgs); } catch(err) {};
            expect(putTemplateHash.callCount).toBe(0);
        });

        test('error is logged', async () => {
            try { await command.performCommand(commandArgs); } catch(err) {};
            expect(consoleError.callCount).toBe(1);
            expect(consoleError.lastCall.args[0]).toContain('test error');
        });

        test('state is saved', async () => {
            try { await command.performCommand(commandArgs); } catch(err) {};
            expect(saveState.callCount).toBe(1);
        });
    });

});


describe('when calling static perform method', () => {
    let performCommand: Sinon.SinonStub;
    let commandArgs: IUpdateOrganizationCommandArgs;
    const sandbox = Sinon.createSandbox();

    beforeEach(() => {
        performCommand = sandbox.stub(UpdateOrganizationCommand.prototype, 'performCommand');
        commandArgs = { templateFile: 'abc.yml'} as unknown as IUpdateOrganizationCommandArgs;
    });

    afterEach(() => {
        sandbox.restore();
    });

    test('static perform passes args to perform', async () => {
        await UpdateOrganizationCommand.Perform(commandArgs);
        expect(performCommand.callCount).toBe(1);
        expect(performCommand.getCall(0).args[0]).toBe(commandArgs);
    });

});