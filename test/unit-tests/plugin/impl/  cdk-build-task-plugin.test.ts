import { CdkBuildTaskPlugin } from "~plugin/impl/cdk-build-task-plugin";

describe('when createing cdk plugin', () => {
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

    test('plugin is applied globally',() => {
        expect(plugin.applyGlobally).toBe(true);
    });

    test('plugin can translate config to command args',() => {
        const commandArgs = plugin.convertToCommandArgs( {
            FilePath: './tasks.ytml',
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