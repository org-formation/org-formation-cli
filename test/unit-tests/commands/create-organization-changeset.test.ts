import { Command, Option } from 'commander';
import { CreateChangeSetCommand, ICreateChangeSetCommandArgs } from '~commands/create-organization-changeset';
import Sinon = require('sinon');
import { ConsoleUtil } from '~util/console-util';
import { AwsUtil } from '~util/aws-util';
import { TemplateRoot } from '~parser/parser';
import { ChangeSetProvider, IStoredChangeSet, IOrganizationChangeSet } from '~change-set/change-set-provider';
import { OrgResourceTypes } from '~parser/model/resource-types';
import { AwsOrganization } from '~aws-provider/aws-organization';
import { PersistedState } from '~state/persisted-state';
import { S3StorageProvider } from '~state/storage-provider';
import { OrganizationBinder } from '~org-binder/org-binder';
import { IBuildTask } from '~org-binder/org-tasks-provider';
import { GlobalState } from '~util/global-state';

describe('when creating create change set command', () => {
    let command: CreateChangeSetCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;

    beforeEach(() => {
        commanderCommand = new Command('root');
        command = new CreateChangeSetCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];
    });

    test('create change set command is created', () => {
        expect(command).toBeDefined();
        expect(subCommanderCommand).toBeDefined();
        expect(subCommanderCommand.name()).toBe('create-change-set');
    });

    test('create change set command has description', () => {
       expect(subCommanderCommand).toBeDefined();
       expect(subCommanderCommand.description()).toBeDefined();
    });

    test('create change set command has templateFile as first argument', () => {
        const firstArg = subCommanderCommand._args[0];
        expect(firstArg).toBeDefined();
        expect(firstArg.required).toBe(true);
        expect(firstArg.name).toBe('templateFile');
    });

    test('command has change set name parameter which is optonal', () => {
        const opts: Option[] = subCommanderCommand.options;
        const changeSetNameOpt = opts.find((x) => x.long === '--change-set-name');
        expect(changeSetNameOpt).toBeDefined();
        expect(changeSetNameOpt.required).toBeFalsy();
    });
});



describe('when executing execute change set command', () => {
    let command: CreateChangeSetCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;
    let createChangeSet: Sinon.SinonSpy;
    let enumTasks: Sinon.SinonStub;
    let saveState: Sinon.SinonStub;
    let runTasks: Sinon.SinonSpy;
    let storageProviderPut: Sinon.SinonStub;
    let storageProviderGet: Sinon.SinonStub;
    const sandbox = Sinon.createSandbox();
    let commandArgs: ICreateChangeSetCommandArgs;
    let consoleOut: Sinon.SinonStub;
    let createTemplate: Sinon.SinonStub;

    beforeEach(async () => {
        consoleOut = sandbox.stub(ConsoleUtil, 'Out');

        commanderCommand = new Command('root');
        command = new CreateChangeSetCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];

        sandbox.stub(AwsUtil, 'GetMasterAccountId').returns(Promise.resolve('123456789012'));
        sandbox.stub(AwsUtil, 'GetBuildProcessAccountId').returns(Promise.resolve('123456789012'));


        const template = await TemplateRoot.create('./test/resources/valid-basic.yml');
        const emptyState = PersistedState.CreateEmpty('123456789012');
        createTemplate = sandbox.stub(TemplateRoot, 'create');
        createTemplate.returns(template);

        createChangeSet = sandbox.spy(ChangeSetProvider.prototype, 'createChangeSet');


        sandbox.stub(AwsOrganization.prototype, 'initialize');

        saveState = sandbox.stub(PersistedState.prototype, 'save');
        storageProviderPut = sandbox.stub(S3StorageProvider.prototype, 'put');
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


        commandArgs = {
            ...subCommanderCommand,
            changeSetName: 'changeSet',
        } as unknown as ICreateChangeSetCommandArgs;
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

    test('create change set is used to create change set', async () => {
        await command.performCommand(commandArgs);
        expect(createChangeSet.callCount).toBe(1);
        expect(createChangeSet.getCall(0).args[0]).toBe('changeSet');
        expect(createChangeSet.getCall(0).args[1]).toBeDefined();
        expect(Array.isArray(createChangeSet.getCall(0).args[2])).toBeTruthy();
        expect(createChangeSet.getCall(0).args[2].length).toBe(1);
        expect(createChangeSet.getCall(0).args[2][0].logicalId).toBe('NewAccount');
        expect(createChangeSet.getCall(0).args[2][0].action).toBe('Create');
    });

    test('changeSet is logged to out', async () => {
        await command.performCommand(commandArgs);
        expect(consoleOut.callCount).toBe(1);
        const output = consoleOut.getCall(0).args[0];
        expect(typeof output).toBe('string');
        const outputObj = JSON.parse(output) as IOrganizationChangeSet;
        expect(outputObj).toBeDefined();
        expect(outputObj.changes.length).toBe(1);
        expect(outputObj.changeSetName).toBe('changeSet');
    });

    test('changeSet is stored', async() => {
        await command.performCommand(commandArgs);
        expect(storageProviderPut.callCount).toBe(1);
        expect(storageProviderPut.getCall(0).args[0]).toBeDefined();
        const changeSet = storageProviderPut.getCall(0).args[0];
        expect(typeof changeSet).toBe('string');
        const changeSetObj = JSON.parse(changeSet) as IStoredChangeSet;
        expect(changeSetObj).toBeDefined();
        expect(changeSetObj.changeSet.changeSetName).toBe('changeSet');
    });
});