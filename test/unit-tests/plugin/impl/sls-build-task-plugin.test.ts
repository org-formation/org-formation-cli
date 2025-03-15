import { SlsBuildTaskPlugin, ISlsCommandArgs, ISlsTask } from "~plugin/impl/sls-build-task-plugin";
import { ICfnSubExpression, ICfnGetAttExpression, ICfnRefExpression, ICfnJoinExpression } from "~core/cfn-expression";
import { IPluginBinding, PluginBinder } from "~plugin/plugin-binder";
import { TemplateRoot } from "~parser/parser";
import { PersistedState } from "~state/persisted-state";
import { TestTemplates } from "../../test-templates";
import { ChildProcessUtility } from "~util/child-process-util";

describe('when creating sls plugin', () => {
    let plugin: SlsBuildTaskPlugin;

    beforeEach(() => {
        plugin = new SlsBuildTaskPlugin();
    });

    test('plugin has the right type',() => {
        expect(plugin.type).toBe('serverless.com');
    });

    test('plugin has the right type for tasks',() => {
        expect(plugin.typeForTask).toBe('update-serverless.com');
    });

    test('plugin can translate config to command args',() => {
        const commandArgs = plugin.convertToCommandArgs( {
            FilePath: './tasks.yaml',
            Type: 'cdk',
            MaxConcurrentTasks: 6,
            FailedTaskTolerance: 4,
            LogicalName: 'test-task',
            Stage: 'stage',
            Config: './config.yml',
            Path: './',
            TaskRoleName: 'TaskRole',
            OrganizationBinding: { IncludeMasterAccount: true}  },
            { organizationFile: './organization.yml'} as any);
        expect(commandArgs.name).toBe('test-task');
        expect(commandArgs.path).toBe('./');
        expect(commandArgs.stage).toBe('stage');
        expect(commandArgs.organizationFile).toBe('./organization.yml');
        expect(commandArgs.maxConcurrent).toBe(6);
        expect(commandArgs.failedTolerance).toBe(4);
        expect(commandArgs.configFile).toBe('./config.yml');
        expect(commandArgs.taskRoleName).toBe('TaskRole');
        expect(commandArgs.organizationBinding).toBeDefined();
        expect(commandArgs.organizationBinding.IncludeMasterAccount).toBe(true);
        expect(commandArgs.runNpmInstall).toBe(false);
        expect(commandArgs.customDeployCommand).toBeUndefined();
    });
});

// There are no tests here so this just errors out
// TODO: If you like Serverless, you should add tests here :D
// describe('when validating task', () => {
//     let plugin: SlsBuildTaskPlugin;
//     let commandArgs: ISlsCommandArgs;

//     beforeEach(() => {
//         plugin = new SlsBuildTaskPlugin();
//         commandArgs = plugin.convertToCommandArgs( {
//             FilePath: './tasks.yaml',
//             Type: 'update-serverless.com',
//             MaxConcurrentTasks: 1,
//             FailedTaskTolerance: 4,
//             LogicalName: 'test-task',
//             Path: './',
//             Config: './README.md',
//             TaskRoleName: 'TaskRole',
//             OrganizationBinding: { IncludeMasterAccount: true}},
//             { organizationFile: './organization.yml'} as any);
//     });
// });


describe('when resolving attribute expressions on update', () => {
    let spawnProcessForAccountSpy: jest.SpyInstance;
    let binding: IPluginBinding<ISlsTask>;
    let task: ISlsTask;
    let plugin: SlsBuildTaskPlugin;
    let template: TemplateRoot;
    let state: PersistedState;
    let binder: PluginBinder<ISlsTask>;

    beforeEach(() => {
        template = TestTemplates.createBasicTemplate();
        state = TestTemplates.createState(template);
        plugin = new SlsBuildTaskPlugin();
        spawnProcessForAccountSpy = jest.spyOn(ChildProcessUtility, 'SpawnProcessForAccount').mockImplementation();

        task = {
            name: 'taskName',
            type: 'sls',
            path: './',
            runNpmInstall: false,
            hash: '123123123',
            logVerbose: true,
            forceDeploy: true,
        };

        binding = {
            action: 'UpdateOrCreate',
            target: {
                targetType: 'sls',
                organizationLogicalName: 'default',
                logicalAccountId: 'Account',
                accountId: '1232342341235',
                region: 'eu-central-1',
                lastCommittedHash: '123123123',
                logicalName: 'taskName',
                definition: task,
            },
            task,
            previousBindingLocalHash: 'abcdef'
        };
        binder = new PluginBinder<ISlsTask>(task, 'default', undefined, state, template, undefined, plugin);
    });

    test('spawn process is called when nothing needs to be substituted', async () => {
        await binder.createPerformForUpdateOrCreate(binding)();
        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
    });

    test('custom deploy command can use CurrentTask.Parameters to get parameters', async () => {
        task.parameters = {
            param: 'val',
        }
        task.customDeployCommand = { 'Fn::Sub': 'something ${CurrentTask.Parameters} something else' } as ICfnSubExpression;

        await binder.createPerformForUpdateOrCreate(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('--param "val"'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
    });


    test('custom deploy command can use multiple substitutions', async () => {
        task.parameters = {
            param: 'val',
        }
        task.customDeployCommand = { 'Fn::Sub': 'something ${CurrentTask.Parameters} ${CurrentAccount} something else' } as ICfnSubExpression;

        await binder.createPerformForUpdateOrCreate(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('--param "val"'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining(' 1232342341235 '), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
    });

    test('parameters can use GetAtt on account', async () => {
        task.parameters = {
            key: { 'Fn::GetAtt': ['Account2', 'Tags.key'] } as ICfnGetAttExpression //resolved to: Value 567
        };
        await binder.createPerformForUpdateOrCreate(binding)();
        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('Value 567'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
    });

    test('resolved parameters will be used in custom deploy command', async () => {
        task.parameters = {
            key: { 'Fn::GetAtt': ['Account2', 'Tags.key'] } as ICfnGetAttExpression //resolved to: Value 567
        };
        task.customDeployCommand = { 'Fn::Sub': 'something ${CurrentTask.Parameters}' } as ICfnSubExpression;

        await binder.createPerformForUpdateOrCreate(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('Value 567'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
    });

    test('options will be resolved in custom deploy command', async () => {
        task.configFile = 'foobar.yml';
        task.stage = 'stage-arg'

        task.customDeployCommand = { 'Fn::Sub': 'something ${CurrentTask.Parameters} ${CurrentTask.ConfigOption} ${CurrentTask.StageOption} ${CurrentTask.RegionOption}' } as ICfnSubExpression;

        await binder.createPerformForUpdateOrCreate(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('foobar.yml'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('stage-arg'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('--region eu-central-1'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
    });

    test('options without value will resolved to empty string in custom deploy command', async () => {

        task.customDeployCommand = { 'Fn::Sub': 'something ${CurrentTask.Parameters} ${CurrentTask.ConfigOption} ${CurrentTask.StageOption} ${CurrentTask.RegionOption}' } as ICfnSubExpression;

        await binder.createPerformForUpdateOrCreate(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.not.stringContaining('--config'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.not.stringContaining('--stage'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('--region'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
    });

    test('resolving Join or Ref to accounts can be used in custom deploy command', async () => {
        task.parameters = {
            myAccountList: { 'Fn::Join': ['|', [
                {'Ref': 'MasterAccount'} as ICfnRefExpression,
                {'Ref': 'CurrentAccount'} as ICfnRefExpression,
            ]] } as ICfnJoinExpression
        };
        task.customDeployCommand = { 'Fn::Sub': 'something ${CurrentTask.Parameters}' } as ICfnSubExpression;

        await binder.createPerformForUpdateOrCreate(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('--myAccountList "1232342341234|1232342341235"'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
    });

    test('unresolvable expression will throw exception', async () => {
        task.parameters = {
            myAccountList: { 'Fn::Join': ['|', [
                {'Ref': 'UnknownAccount'} as ICfnRefExpression,
                {'Ref': 'CurrentAccount'} as ICfnRefExpression,
            ]] } as ICfnJoinExpression
        };
        task.customDeployCommand = { 'Fn::Sub': 'something ${CurrentTask.Parameters}' } as ICfnSubExpression;
        const performDeploy = binder.createPerformForUpdateOrCreate(binding);

        await expect(performDeploy).rejects.toThrowError(/Join/);
        await expect(performDeploy).rejects.toThrowError(/UnknownAccount/);
    });

    test('unresolvable expression in custom deploy command will throw exception', async () => {
        task.customDeployCommand = { 'Fn::Sub': 'something ${xyz}' } as ICfnSubExpression;
        const performDeploy = binder.createPerformForUpdateOrCreate(binding);

        await expect(performDeploy).rejects.toThrowError(/xyz/);
    });


    test('can resolve AWS::AccountId', async () => {
        task.parameters = {
            key: { Ref: 'AWS::AccountId' } as ICfnRefExpression
        };
        await binder.createPerformForUpdateOrCreate(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('1232342341235'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
    });

    test('can resolve AWS::Region', async () => {
        task.parameters = {
            key: { Ref: 'AWS::Region' } as ICfnRefExpression
        };
        await binder.createPerformForUpdateOrCreate(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('eu-central-1'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });
});


describe('when resolving attribute expressions on remove', () => {
    let spawnProcessForAccountSpy: jest.SpyInstance;
    let binding: IPluginBinding<ISlsTask>;
    let task: ISlsTask;
    let plugin: SlsBuildTaskPlugin;
    let template: TemplateRoot;
    let state: PersistedState;
    let binder: PluginBinder<ISlsTask>;

    beforeEach(() => {
        template = TestTemplates.createBasicTemplate();
        state = TestTemplates.createState(template);
        plugin = new SlsBuildTaskPlugin();
        spawnProcessForAccountSpy = jest.spyOn(ChildProcessUtility, 'SpawnProcessForAccount').mockImplementation();

        task = {
            name: 'taskName',
            type: 'sls',
            path: './',
            slsVersion: 2,
            runNpmInstall: false,
            hash: '123123123',
            logVerbose: true,
            forceDeploy: true,
        };

        binding = {
            action: 'Delete',
            target: {
                targetType: 'sls',
                organizationLogicalName: 'default',
                logicalAccountId: 'Account',
                accountId: '1232342341235',
                region: 'eu-central-1',
                lastCommittedHash: '123123123',
                logicalName: 'taskName',
                definition: task,
            },
            task,
            previousBindingLocalHash: 'abcdef'
        };
        binder = new PluginBinder<ISlsTask>(task, 'default', undefined, state, template, undefined, plugin);
    });

    test('spawn process is called when nothing needs to be substituted', async () => {
        await binder.createPerformForRemove(binding)();
        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
    });

    test('custom deploy command can use CurrentTask.Parameters to get parameters', async () => {
        task.parameters = {
            param: 'val',
        }
        task.customDeployCommand = { 'Fn::Sub': 'something ${CurrentTask.Parameters} something else' } as ICfnSubExpression;

        await binder.createPerformForRemove(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('--param "val"'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
    });

    test('custom deploy command can use multiple substitutions', async () => {
        task.parameters = {
            param: 'val',
        }
        task.customRemoveCommand = { 'Fn::Sub': 'something ${CurrentTask.Parameters} ${CurrentAccount} something else' } as ICfnSubExpression;

        await binder.createPerformForRemove(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('--param "val"'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining(' 1232342341235 '), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
    });

    test('parameters can use GetAtt on account', async () => {
        task.parameters = {
            key: { 'Fn::GetAtt': ['Account2', 'Tags.key'] } as ICfnGetAttExpression //resolved to: Value 567
        };
        await binder.createPerformForRemove(binding)();
        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('Value 567'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
    });

    test('resolved parameters will be used in custom deploy command', async () => {
        task.parameters = {
            key: { 'Fn::GetAtt': ['Account2', 'Tags.key'] } as ICfnGetAttExpression //resolved to: Value 567
        };
        task.customRemoveCommand = { 'Fn::Sub': 'something ${CurrentTask.Parameters}' } as ICfnSubExpression;

        await binder.createPerformForRemove(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('Value 567'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('something'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
    });

    test('local variables will be resolved in custom remove command', async () => {
        task.configFile = 'foobar.yml';
        task.stage = 'stage-arg'

        task.customRemoveCommand = { 'Fn::Sub': 'something ${CurrentTask.Parameters} ${config} ${stage} ${region}' } as ICfnSubExpression;

        await binder.createPerformForRemove(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('foobar.yml'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('stage-arg'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('eu-central-1'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.not.stringContaining('--config'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.not.stringContaining('--stage'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.not.stringContaining('--region'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
    });

    test('options will be resolved in custom remove command', async () => {
        task.configFile = 'foobar.yml';
        task.stage = 'stage-arg'

        task.customRemoveCommand = { 'Fn::Sub': 'something ${CurrentTask.Parameters} ${CurrentTask.ConfigOption} ${CurrentTask.StageOption} ${CurrentTask.RegionOption}' } as ICfnSubExpression;

        await binder.createPerformForRemove(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('foobar.yml'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('stage-arg'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('--region eu-central-1'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
    });

    test('options without value will resolved to empty string in custom remove command', async () => {
        task.customRemoveCommand = { 'Fn::Sub': 'something ${CurrentTask.Parameters} ${CurrentTask.ConfigOption} ${CurrentTask.StageOption} ${CurrentTask.RegionOption}' } as ICfnSubExpression;

        await binder.createPerformForRemove(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.not.stringContaining('--config'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.not.stringContaining('--stage'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('--region'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
    });


    test('resolving Join or Ref to accounts can be used in custom deploy command', async () => {
        task.parameters = {
            myAccountList: { 'Fn::Join': ['|', [
                {'Ref': 'MasterAccount'} as ICfnRefExpression,
                {'Ref': 'CurrentAccount'} as ICfnRefExpression,
            ]] } as ICfnJoinExpression
        };
        task.customDeployCommand = { 'Fn::Sub': 'something ${CurrentTask.Parameters}' } as ICfnSubExpression;

        await binder.createPerformForRemove(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('--myAccountList "1232342341234|1232342341235"'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
    });


    test('unresolvable expression will throw exception', async () => {
        task.parameters = {
            myAccountList: { 'Fn::Join': ['|', [
                {'Ref': 'UnknownAccount'} as ICfnRefExpression,
                {'Ref': 'CurrentAccount'} as ICfnRefExpression,
            ]] } as ICfnJoinExpression
        };
        task.customRemoveCommand = { 'Fn::Sub': 'something ${CurrentTask.Parameters}' } as ICfnSubExpression;
        const performRemove = binder.createPerformForRemove(binding);

        await expect(performRemove).rejects.toThrowError(/Join/);
        await expect(performRemove).rejects.toThrowError(/UnknownAccount/);
    });

    test('unresolvable expression in custom remove command will throw exception', async () => {
        task.customRemoveCommand = { 'Fn::Sub': 'something ${xyz}' } as ICfnSubExpression;
        const performRemove = binder.createPerformForRemove(binding);

        await expect(performRemove).rejects.toThrowError(/xyz/);
    });

    test('can resolve AWS::AccountId', async () => {
        task.parameters = {
            key: { Ref: 'AWS::AccountId' } as ICfnRefExpression
        };
        await binder.createPerformForRemove(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('1232342341235'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
    });

    test('can resolve AWS::Region', async () => {
        task.parameters = {
            key: { Ref: 'AWS::Region' } as ICfnRefExpression
        };
        await binder.createPerformForRemove(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('eu-central-1'), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });
});



describe('when resolving parameters on using different versions of the SLS framework', () => {
    let spawnProcessForAccountSpy: jest.SpyInstance;
    let binding: IPluginBinding<ISlsTask>;
    let task: ISlsTask;
    let plugin: SlsBuildTaskPlugin;
    let template: TemplateRoot;
    let state: PersistedState;
    let binder: PluginBinder<ISlsTask>;

    afterEach(() => {
        jest.restoreAllMocks();
    });

    beforeEach(() => {
        template = TestTemplates.createBasicTemplate();
        state = TestTemplates.createState(template);
        plugin = new SlsBuildTaskPlugin();
        spawnProcessForAccountSpy = jest.spyOn(ChildProcessUtility, 'SpawnProcessForAccount').mockImplementation();

        task = {
            name: 'taskName',
            type: 'sls',
            path: './',
            parameters: {"key": "value", "n": "42"},
            runNpmInstall: false,
            hash: '123123123',
            logVerbose: true,
            forceDeploy: true,
        };

        binding = {
            action: 'UpdateOrCreate',
            target: {
                targetType: 'sls',
                organizationLogicalName: 'default',
                logicalAccountId: 'Account',
                accountId: '1232342341235',
                region: 'eu-central-1',
                lastCommittedHash: '123123123',
                logicalName: 'taskName',
                definition: task,
            },
            task,
            previousBindingLocalHash: 'abcdef'
        };
        binder = new PluginBinder<ISlsTask>(task, 'default', undefined, state, template, undefined, plugin);
    });

    test('version 3 of the tasks uses --param', async () => {
        task.slsVersion = 3;
        await binder.createPerformForUpdateOrCreate(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining(' --param="key=value" --param="n=42" '), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
    });

    test('version 2 of the tasks uses --key=value', async () => {
        task.slsVersion = 2;
        await binder.createPerformForUpdateOrCreate(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).toHaveBeenCalledWith(expect.anything(), expect.stringContaining(' --key "value" --n "42"  '), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
    });

    test('not specifying version uses --key=value', async () => {
        task.slsVersion = undefined;
        await binder.createPerformForUpdateOrCreate(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).toHaveBeenCalledWith(expect.anything(), expect.stringContaining(' --key "value" --n "42"  '), expect.anything(), undefined, "eu-central-1", expect.anything(), true);
    });
});

