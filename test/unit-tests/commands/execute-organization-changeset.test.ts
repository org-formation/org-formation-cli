import { Command, Option } from 'commander';
import { ExecuteChangeSetCommand, IExecuteChangeSetCommandArgs } from '~commands/execute-organization-changeset';
import Sinon = require('sinon');
import { ConsoleUtil } from '~util/console-util';
import { TemplateRoot } from '~parser/parser';
import { PersistedState } from '~state/persisted-state';
import { ICfnTask } from '~cfn-binder/cfn-task-provider';
import { CfnTaskRunner } from '~cfn-binder/cfn-task-runner';
import { AwsUtil } from '~util/aws-util';
import { readFileSync } from 'fs';
import { ChangeSetProvider, IStoredChangeSet, IOrganizationChange } from '~change-set/change-set-provider';
import { S3StorageProvider } from '~state/storage-provider';
import { CloudFormationBinder } from '~cfn-binder/cfn-binder';
import { OrganizationBinder } from '~org-binder/org-binder';
import { OrgResourceTypes } from '~parser/model/resource-types';
import { IBuildTask } from '~org-binder/org-tasks-provider';
import { TaskRunner } from '~org-binder/org-task-runner';
import { AwsOrganization } from '~aws-provider/aws-organization';
import { GlobalState } from '~util/global-state';

describe('when creating execute change set command', () => {
    let command: ExecuteChangeSetCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;

    beforeEach(() => {
        commanderCommand = new Command('root');
        command = new ExecuteChangeSetCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];
    });

    test('execute change set command is created', () => {
        expect(command).toBeDefined();
        expect(subCommanderCommand).toBeDefined();
        expect(subCommanderCommand.name()).toBe('execute-change-set');
    });

    test('execute change set command has description', () => {
       expect(subCommanderCommand).toBeDefined();
       expect(subCommanderCommand.description()).toBeDefined();
    });

    test('execute change set command has changeSetNaem as first argument', () => {
        const firstArg = subCommanderCommand._args[0];
        expect(firstArg).toBeDefined();
        expect(firstArg.required).toBe(true);
        expect(firstArg.name).toBe('change-set-name');
    });
});



describe('when executing execute change set command', () => {
    let command: ExecuteChangeSetCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;
    let getChangeSet: Sinon.SinonStub;
    let enumTasks: Sinon.SinonStub;
    let saveState: Sinon.SinonStub;
    let runTasks: Sinon.SinonSpy;
    let storageProviderGet: Sinon.SinonStub;
    const sandbox = Sinon.createSandbox();
    let commandArgs: IExecuteChangeSetCommandArgs;
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
        command = new ExecuteChangeSetCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];

        sandbox.stub(AwsUtil, 'GetMasterAccountId').returns(Promise.resolve('123456789012'));
        sandbox.stub(AwsUtil, 'GetBuildProcessAccountId').returns(Promise.resolve('123456789012'));

        const template = TemplateRoot.create('./test/resources/valid-basic.yml');
        templateHash = template.hash;

        getChangeSet = sandbox.stub(ChangeSetProvider.prototype, 'getChangeSet');
        getChangeSet.returns(Promise.resolve({
            template: template.contents,
            changeSet: {
                changeSetName: 'changeSet',
                changes: [{
                    logicalId: 'NewAccount',
                    type:OrgResourceTypes.Account,
                    action: 'Create',
                 }]}
        }));

        const emptyState = PersistedState.CreateEmpty('123456789012');

        sandbox.stub(AwsOrganization.prototype, 'initialize');

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

        commandArgs = {
            ...subCommanderCommand,
            changeSetName: 'changeSet',
        } as unknown as IExecuteChangeSetCommandArgs;
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

    test('get changeset is called to get cbangeSet', async () => {
        await command.performCommand(commandArgs);
        expect(getChangeSet.callCount).toBe(1);
        expect(getChangeSet.getCall(0).args[0]).toBe('changeSet')
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

    describe('and changeset doesnt match tasks', () => {
        beforeEach(() => {
            enumTasks.returns([{
                type: OrgResourceTypes.Account,
                logicalId: 'XXXXX',
                action: 'Create',
                result: '111111111111',
                perform: (task: IBuildTask) => {},
            } as IBuildTask]);
        });

        afterEach(() => {
            sandbox.restore();
        });


        test('error is logged', async () => {
            await command.performCommand(commandArgs);
            expect(consoleError.callCount).toBe(1);
            expect(consoleError.firstCall.args[0]).toContain('state has changed')
        });

        test('task runner has not ran', async () => {
            await command.performCommand(commandArgs);
            expect(runTasks.callCount).toBe(0);
        });

        test('state is not saved', async () => {
            await command.performCommand(commandArgs);
            expect(saveState.callCount).toBe(0);
        });
    })

    describe('and changeset is not found', () => {
        beforeEach(() => {
            getChangeSet.returns(undefined);
        });

        afterEach(() => {
            sandbox.restore();
        });

        test('error is logged', async () => {
            await command.performCommand(commandArgs);
            expect(consoleError.callCount).toBe(1);
            expect(consoleError.firstCall.args[0]).toContain('not found')
            expect(consoleError.firstCall.args[0]).toContain('changeSet')
        });

        test('task runner has not ran', async () => {
            await command.performCommand(commandArgs);
            expect(runTasks.callCount).toBe(0);
        });

        test('state is not saved', async () => {
            await command.performCommand(commandArgs);
            expect(saveState.callCount).toBe(0);
        });
    });
});