import { CopyToS3TaskPlugin } from "~plugin/impl/s3-copy-build-task-plugin";

describe('when createing s3 copy plugin', () => {
    let plugin: CopyToS3TaskPlugin;

    beforeEach(() => {
        plugin = new CopyToS3TaskPlugin();
    });

    test('plugin has the right type',() => {
        expect(plugin.type).toBe('copy-to-s3');
    });


    test('plugin has the right type for tasks',() => {
        expect(plugin.typeForTask).toBe('copy-to-s3');
    });

    test('plugin is applied globally',() => {
        expect(plugin.applyGlobally).toBe(true);
    });

    test('plugin can translate config to command args',() => {
        const commandArgs = plugin.convertToCommandArgs( {
            FilePath: './tasks.ytml',
            Type: 'cdk',
            LogicalName: 'test-task',
            LocalPath: './file.ext',
            RemotePath: 's3://bucket/path',
            TaskRoleName: 'TaskRole',
            OrganizationBinding: { IncludeMasterAccount: true}},
            { organizationFile: './organization.yml'} as any);
        expect(commandArgs.name).toBe('test-task');
        expect(commandArgs.localPath).toBe('file.ext');
        expect(commandArgs.remotePath).toBe('s3://bucket/path');
        expect(commandArgs.organizationFile).toBe('./organization.yml');
        expect(commandArgs.maxConcurrent).toBe(1);
        expect(commandArgs.failedTolerance).toBe(0);
        expect(commandArgs.taskRoleName).toBe('TaskRole');
        expect(commandArgs.organizationBinding).toBeDefined();
        expect(commandArgs.organizationBinding.IncludeMasterAccount).toBe(true);
    });
});