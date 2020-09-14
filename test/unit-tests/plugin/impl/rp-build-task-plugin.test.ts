import { RpBuildTaskPlugin, IRpCommandArgs } from "~plugin/impl/rp-build-task-plugin";

describe('when creating rp plugin', () => {
    let plugin: RpBuildTaskPlugin;

    beforeEach(() => {
        plugin = new RpBuildTaskPlugin();
    });

    test('plugin has the right type',() => {
        expect(plugin.type).toBe('register-type');
    });

    test('plugin has the right type for tasks',() => {
        expect(plugin.typeForTask).toBe('register-type');
    });

    test('plugin can translate config to command args',() => {
        const commandArgs = plugin.convertToCommandArgs( {
            FilePath: './tasks.yaml',
            SchemaHandlerPackage: 'path/to/package',
            ResourceType: 'My::Service::Resource',
            ExecutionRole: 'arn:my-role',
            Type: 'cdk',
            MaxConcurrentTasks: 6,
            FailedTaskTolerance: 4,
            LogicalName: 'test-task',
            TaskRoleName: 'TaskRole',
            OrganizationBinding: { IncludeMasterAccount: true}},
            { organizationFile: './organization.yml'} as any);
        expect(commandArgs.name).toBe('test-task');
        expect(commandArgs.schemaHandlerPackage).toBe('path/to/package');
        expect(commandArgs.organizationFile).toBe('./organization.yml');
        expect(commandArgs.maxConcurrent).toBe(6);
        expect(commandArgs.failedTolerance).toBe(4);
        expect(commandArgs.taskRoleName).toBe('TaskRole');
        expect(commandArgs.organizationBinding).toBeDefined();
        expect(commandArgs.organizationBinding.IncludeMasterAccount).toBe(true);
        expect(commandArgs.resourceType).toBe('My::Service::Resource');
        expect(commandArgs.executionRole).toBe('arn:my-role');
    });

});

describe('when validating task', () => {
    let plugin: RpBuildTaskPlugin;
    let commandArgs: IRpCommandArgs;

    beforeEach(() => {
        plugin = new RpBuildTaskPlugin();
        commandArgs = plugin.convertToCommandArgs( {
            FilePath: './tasks.yaml',
            Type: 'register-type',
            MaxConcurrentTasks: 1,
            FailedTaskTolerance: 4,
            LogicalName: 'test-task',
            SchemaHandlerPackage: 's3://bucket/path/to/package',
            ResourceType: 'My::Service::Resource',
            TaskRoleName: 'TaskRole',
            OrganizationBinding: { IncludeMasterAccount: true}},
            { organizationFile: './organization.yml'} as any);
    });

    test('missing resource type throws', () => {
        delete commandArgs.resourceType;
        expect( ()=> { plugin.validateCommandArgs(commandArgs) }).toThrowError(/attribute ResourceType is required/);
    });


    test('missing schemaHandlerPackage throws', () => {
        delete commandArgs.schemaHandlerPackage;
        expect( ()=> { plugin.validateCommandArgs(commandArgs) }).toThrowError(/attribute SchemaHandlerPackage is required/);
    });

    test('missing executionRole does not throw', () => {
        delete commandArgs.executionRole;
        plugin.validateCommandArgs(commandArgs);
    });


    test('invalid schema handler package path throws', () => {
        commandArgs.schemaHandlerPackage = 'something different';
        expect( ()=> { plugin.validateCommandArgs(commandArgs) }).toThrowError(/SchemaHandlerPackage attribute expected to start with 's3:\/\/'/);
        expect( ()=> { plugin.validateCommandArgs(commandArgs) }).toThrowError(/something different/);
    });

});
