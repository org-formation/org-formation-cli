import { CdkBuildTaskPlugin, ICdkTask, ICdkCommandArgs } from "~plugin/impl/cdk-build-task-plugin";
import { ChildProcessUtility } from "~util/child-process-util";
import { IPluginBinding, PluginBinder } from "~plugin/plugin-binder";
import { ICfnSubExpression, ICfnGetAttExpression, ICfnRefExpression, ICfnCopyValue, ICfnJoinExpression } from "~core/cfn-expression";
import { TemplateRoot } from "~parser/parser";
import { PersistedState } from "~state/persisted-state";
import { TestTemplates } from "../../test-templates";
import { AwsUtil } from "~util/aws-util";

describe('when creating cdk plugin', () => {
    let plugin: CdkBuildTaskPlugin;

    beforeEach(() => {
        plugin = new CdkBuildTaskPlugin();
    });

    test('plugin has the right type',() => {
        expect(plugin.type).toBe('cdk');
    });

    test('plugin has the right type for tasks',() => {
        expect(plugin.typeForTask).toBe('update-cdk');
    });

    test('plugin can translate config to command args',() => {
        const commandArgs = plugin.convertToCommandArgs( {
            FilePath: './tasks.yaml',
            Type: 'cdk',
            MaxConcurrentTasks: 6,
            FailedTaskTolerance: 4,
            LogicalName: 'test-task',
            Path: './',
            TaskRoleName: 'TaskRole',
            OrganizationBinding: { IncludeMasterAccount: true}},
            { organizationFile: './organization.yml'} as any);
        expect(commandArgs.name).toBe('test-task');
        expect(commandArgs.path).toBe('./');
        expect(commandArgs.organizationFile).toBe('./organization.yml');
        expect(commandArgs.maxConcurrent).toBe(6);
        expect(commandArgs.failedTolerance).toBe(4);
        expect(commandArgs.taskRoleName).toBe('TaskRole');
        expect(commandArgs.organizationBinding).toBeDefined();
        expect(commandArgs.organizationBinding.IncludeMasterAccount).toBe(true);
        expect(commandArgs.runNpmBuild).toBe(false);
        expect(commandArgs.runNpmInstall).toBe(false);
        expect(commandArgs.customDeployCommand).toBeUndefined();
    });

});

describe('when validating task', () => {
    let plugin: CdkBuildTaskPlugin;
    let commandArgs: ICdkCommandArgs;

    beforeEach(() => {
        plugin = new CdkBuildTaskPlugin();
        commandArgs = plugin.convertToCommandArgs( {
            FilePath: './tasks.yaml',
            Type: 'cdk',
            MaxConcurrentTasks: 1,
            FailedTaskTolerance: 4,
            LogicalName: 'test-task',
            Path: './',
            TaskRoleName: 'TaskRole',
            OrganizationBinding: { IncludeMasterAccount: true}},
            { organizationFile: './organization.yml'} as any);
    });

    test('test', () => {
        expect(commandArgs).toBeDefined();
    })
});

describe('when resolving attribute expressions on update', () => {
    let spawnProcessForAccountSpy: jest.SpyInstance;
    let binding: IPluginBinding<ICdkTask>;
    let task: ICdkTask;
    let plugin: CdkBuildTaskPlugin;
    let template: TemplateRoot;
    let state: PersistedState;
    let binder: PluginBinder<ICdkTask>;

    beforeEach(() => {
        template = TestTemplates.createBasicTemplate();
        state = TestTemplates.createState(template);
        plugin = new CdkBuildTaskPlugin();
        spawnProcessForAccountSpy = jest.spyOn(ChildProcessUtility, 'SpawnProcessForAccount').mockImplementation();

        task = {
            name: 'taskName',
            type: 'cdk',
            path: './',
            runNpmBuild: false,
            runNpmInstall: false,
            hash: '123123123',
            logVerbose: true,
            forceDeploy: true,
        };

        binding = {
            action: 'UpdateOrCreate',
            target: {
                targetType: 'cdk',
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
        binder = new PluginBinder<ICdkTask>(task, 'default', undefined, state, template, undefined, plugin);
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
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('-c \'param=val\''), expect.anything(), undefined, expect.anything(), true);
    });


    test('custom deploy command can use multiple substitutions', async () => {
        task.parameters = {
            param: 'val',
        }
        task.customDeployCommand = { 'Fn::Sub': 'something ${CurrentTask.Parameters} ${CurrentAccount} something else' } as ICfnSubExpression;

        await binder.createPerformForUpdateOrCreate(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('-c \'param=val\''), expect.anything(), undefined, expect.anything(), true);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining(' 1232342341235 '), expect.anything(), undefined, expect.anything(), true);
    });

    test('parameters can use GetAtt on account', async () => {
        task.parameters = {
            key: { 'Fn::GetAtt': ['Account2', 'Tags.key'] } as ICfnGetAttExpression //resolved to: Value 567
        };
        await binder.createPerformForUpdateOrCreate(binding)();
        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('Value 567'), expect.anything(), undefined, expect.anything(), true);
    });

    test('resolved parameters will be used in custom deploy command', async () => {
        task.parameters = {
            key: { 'Fn::GetAtt': ['Account2', 'Tags.key'] } as ICfnGetAttExpression //resolved to: Value 567
        };
        task.customDeployCommand = { 'Fn::Sub': 'something ${CurrentTask.Parameters}' } as ICfnSubExpression;

        await binder.createPerformForUpdateOrCreate(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('Value 567'), expect.anything(), undefined, expect.anything(), true);
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
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('myAccountList=1232342341234|1232342341235'), expect.anything(), undefined, expect.anything(), true);
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
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('1232342341235'), expect.anything(), undefined, expect.anything(), true);
    });

    test('can resolve AWS::Region', async () => {
        task.parameters = {
            key: { Ref: 'AWS::Region' } as ICfnRefExpression
        };
        await binder.createPerformForUpdateOrCreate(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('eu-central-1'), expect.anything(), undefined, expect.anything(), true);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });
});

describe('when resolving attribute expressions on remove', () => {
    let spawnProcessForAccountSpy: jest.SpyInstance;
    let binding: IPluginBinding<ICdkTask>;
    let task: ICdkTask;
    let plugin: CdkBuildTaskPlugin;
    let template: TemplateRoot;
    let state: PersistedState;
    let binder: PluginBinder<ICdkTask>;

    beforeEach(() => {
        template = TestTemplates.createBasicTemplate();
        state = TestTemplates.createState(template);
        plugin = new CdkBuildTaskPlugin();
        spawnProcessForAccountSpy = jest.spyOn(ChildProcessUtility, 'SpawnProcessForAccount').mockImplementation();

        task = {
            name: 'taskName',
            type: 'cdk',
            path: './',
            runNpmBuild: false,
            runNpmInstall: false,
            hash: '123123123',
            logVerbose: true,
            forceDeploy: true,
        };

        binding = {
            action: 'Delete',
            target: {
                targetType: 'cdk',
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

        binder = new PluginBinder<ICdkTask>(task, 'default', undefined, state, template, undefined, plugin);
    });

    test('spawn process is called when nothing needs to be substituted', async () => {
        await binder.createPerformForRemove(binding)();
        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
    });

    test('custom deploy command can use CurrentTask.Parameters to get parameters', async () => {
        task.parameters = {
            param: 'val',
        }
        task.customRemoveCommand = { 'Fn::Sub': 'something ${CurrentTask.Parameters} something else' } as ICfnSubExpression;

        await binder.createPerformForRemove(binding)();
        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('-c \'param=val\''), expect.anything(), undefined, expect.anything(), true);
    });

    test('custom remove command can use multiple substitutions', async () => {
        task.parameters = {
            param: 'val',
        }
        task.customRemoveCommand = { 'Fn::Sub': 'something ${CurrentTask.Parameters} ${CurrentAccount} something else' } as ICfnSubExpression;

        await binder.createPerformForRemove(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('-c \'param=val\''), expect.anything(), undefined, expect.anything(), true);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining(' 1232342341235 '), expect.anything(), undefined, expect.anything(), true);
    });

    test('parameters can use GetAtt on account', async () => {
        task.parameters = {
            key: { 'Fn::GetAtt': ['Account2', 'Tags.key'] } as ICfnGetAttExpression //resolved to: Value 567
        };

        await binder.createPerformForRemove(binding)()

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('Value 567'), expect.anything(), undefined, expect.anything(), true);
    });

    test('resolved parameters can be used in custom deploy command', async () => {
        task.parameters = {
            key: { 'Fn::GetAtt': ['Account2', 'Tags.key'] } as ICfnGetAttExpression //resolved to: Value 567
        };
        task.customRemoveCommand = { 'Fn::Sub': 'something ${CurrentTask.Parameters}' } as ICfnSubExpression;

        await binder.createPerformForRemove(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('Value 567'), expect.anything(), undefined, expect.anything(), true);
    });


    test('resolving Join or Ref to accounts can be used in custom deploy command', async () => {
        task.parameters = {
            myAccountList: { 'Fn::Join': ['|', [
                {'Ref': 'MasterAccount'} as ICfnRefExpression,
                {'Ref': 'CurrentAccount'} as ICfnRefExpression,
            ]] } as ICfnJoinExpression
        };
        task.customRemoveCommand = { 'Fn::Sub': 'something ${CurrentTask.Parameters}' } as ICfnSubExpression;

        await binder.createPerformForRemove(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('myAccountList=1232342341234|1232342341235'), expect.anything(), undefined, expect.anything(), true);
    });


    test('can resolve AWS::AccountId', async () => {
        task.parameters = {
            key: { Ref: 'AWS::AccountId' } as ICfnRefExpression
        };

        await binder.createPerformForRemove(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('1232342341235'), expect.anything(), undefined, expect.anything(), true);
    });

    test('can resolve AWS::Region', async () => {
        task.parameters = {
            key: { Ref: 'AWS::Region' } as ICfnRefExpression
        };

        await binder.createPerformForRemove(binding)();

        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('eu-central-1'), expect.anything(), undefined, expect.anything(), true);
    });

    test('can CopyValue', async () => {
        const getExportMock = jest.spyOn(AwsUtil, 'GetCloudFormationExport').mockReturnValue(Promise.resolve('XYZ'));

        task.parameters = {
            key: { 'Fn::CopyValue': ['CfnExport'] } as ICfnCopyValue
        };

        await binder.createPerformForRemove(binding)();

        expect(getExportMock).toHaveBeenCalled();
        expect(spawnProcessForAccountSpy).toHaveBeenCalledTimes(1);
        expect(spawnProcessForAccountSpy).lastCalledWith(expect.anything(), expect.stringContaining('XYZ'), expect.anything(), undefined, expect.anything(), true);
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

    afterEach(() => {
        jest.restoreAllMocks();
    });
});