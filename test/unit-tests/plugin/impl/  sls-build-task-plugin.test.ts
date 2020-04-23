import { SlsBuildTaskPlugin } from "~plugin/impl/sls-build-task-plugin";

describe('when createing sls plugin', () => {
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
            FilePath: './tasks.ytml',
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