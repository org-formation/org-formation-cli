import { CopyToS3TaskPlugin, IS3CopyCommandArgs, IS3CopyTask } from "~plugin/impl/s3-copy-build-task-plugin";
import { IPluginBinding, PluginBinder } from "~plugin/plugin-binder";
import { PersistedState } from "~state/persisted-state";
import { TemplateRoot } from "~parser/parser";
import { TestTemplates } from "../../test-templates";
import { S3 } from "aws-sdk";
import { on } from '@jurijzahn8019/aws-promise-jest-mock';
import { AwsUtil } from "~util/aws-util";
import { OrgFormationError } from "~org-formation-error";
import fs from "fs"

jest.mock('aws-sdk');
jest.mock('fs');

describe('when creating s3 copy plugin', () => {
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

    test('plugin can translate config to command args',() => {
        const commandArgs = plugin.convertToCommandArgs( {
            FilePath: './tasks.yaml',
            Type: 'cdk',
            LogicalName: 'test-task',
            LocalPath: './file.ext',
            RemotePath: 's3://bucket/path',
            TaskRoleName: 'TaskRole',
            TemplatingContext: {
                testAttribute: "testValue"
            },
            OrganizationBinding: { IncludeMasterAccount: true}},
            { organizationFile: './organization.yml'} as any);
        expect(commandArgs.name).toBe('test-task');
        expect(commandArgs.localPath).toBe('file.ext');
        expect(commandArgs.remotePath).toBe('s3://bucket/path');
        expect(commandArgs.organizationFile).toBe('./organization.yml');
        expect(commandArgs.maxConcurrent).toBe(1);
        expect(commandArgs.failedTolerance).toBe(0);
        expect(commandArgs.taskRoleName).toBe('TaskRole');
        expect(commandArgs.templatingContext).toStrictEqual({
            testAttribute: "testValue"
        })
        expect(commandArgs.organizationBinding).toBeDefined();
        expect(commandArgs.organizationBinding.IncludeMasterAccount).toBe(true);
    });
    
    test('exception is thrown when templatingContext and zipBeforePut:true are used together', async () => {
        
        jest.spyOn(fs, "existsSync").mockReturnValueOnce(true)
        
        const commandArgs = {
            localPath: './file.ext',
            organizationBinding: { IncludeMasterAccount: true},
            zipBeforePut: true,
            templatingContext: {},
        } as IS3CopyCommandArgs;
        
        expect(() => plugin.validateCommandArgs(commandArgs)).toThrow(
            new OrgFormationError(`task ${commandArgs.name} can not use zipBeforePut and templatingContext together.`)
        )
    });
});

describe('when performing copy to s3', () => {
    let binding: IPluginBinding<IS3CopyTask>;
    let task: IS3CopyTask;
    let plugin: CopyToS3TaskPlugin;
    let template: TemplateRoot;
    let state: PersistedState;
    let binder: PluginBinder<IS3CopyTask>;
    let s3putObjectSpy: any;

    beforeEach(() => {
        template = TestTemplates.createBasicTemplate();
        state = TestTemplates.createState(template);
        plugin = new CopyToS3TaskPlugin();

        jest.spyOn(AwsUtil, 'GetS3Service').mockResolvedValue(new S3());

        const s3mock = on(S3, { snapshot: false });
        s3putObjectSpy = s3mock
            .mock('putObject')
            .resolve({});

        task = {
            name: 'taskName',
            type: 'copy-to-s3',
            localPath: './README.md',
            remotePath: 's3://bucket/path/file',
            zipBeforePut: false,
            hash: '123123123',
            logVerbose: true,
            forceDeploy: true,
        };

        binding = {
            action: 'UpdateOrCreate',
            target: {
                targetType: 'copy-to-s3',
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
        binder = new PluginBinder<IS3CopyTask>(task, 'default', undefined, state, template, undefined, plugin);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('object is put in s3', async () => {
        await binder.createPerformForUpdateOrCreate(binding)();
        expect(s3putObjectSpy.mock).toHaveBeenCalledTimes(1);
    });

    test('exception is thrown for unresolved localPath', async () => {
        task.localPath = { 'Fn::Sub': 'something ${xyz}' } as any;
        const performDeploy = binder.createPerformForUpdateOrCreate(binding);

        await expect(performDeploy).rejects.toThrowError(/xyz/);
        await expect(performDeploy).rejects.toThrowError(/LocalPath/);
    });

    test('exception is thrown for unresolved remotePath', async () => {
        task.remotePath = { 'Fn::Sub': 'something ${xyz}' } as any;
        const performDeploy = binder.createPerformForUpdateOrCreate(binding);

        await expect(performDeploy).rejects.toThrowError(/xyz/);
        await expect(performDeploy).rejects.toThrowError(/RemotePath/);
    });
});

describe('when removing copy-to-s3', () => {
    let binding: IPluginBinding<IS3CopyTask>;
    let task: IS3CopyTask;
    let plugin: CopyToS3TaskPlugin;
    let template: TemplateRoot;
    let state: PersistedState;
    let binder: PluginBinder<IS3CopyTask>;
    let s3deleteObjectSpy: any;

    beforeEach(() => {
        template = TestTemplates.createBasicTemplate();
        state = TestTemplates.createState(template);
        plugin = new CopyToS3TaskPlugin();

        jest.spyOn(AwsUtil, 'GetS3Service').mockResolvedValue(new S3());

        const s3mock = on(S3, { snapshot: false });
        s3deleteObjectSpy = s3mock
            .mock('deleteObject')
            .resolve({});

        task = {
            name: 'taskName',
            type: 'copy-to-s3',
            localPath: './README.md',
            remotePath: 's3://bucket/path/file',
            zipBeforePut: false,
            hash: '123123123',
            logVerbose: true,
            forceDeploy: true,
        };

        binding = {
            action: 'Delete',
            target: {
                targetType: 'copy-to-s3',
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
        binder = new PluginBinder<IS3CopyTask>(task, 'default', undefined, state, template, undefined, plugin);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('object is deleted in s3', async () => {
        await binder.createPerformForRemove(binding)();
        expect(s3deleteObjectSpy.mock).toHaveBeenCalledTimes(1);
    });

    test('exception is thrown for unresolved localPath', async () => {
        task.localPath = { 'Fn::Sub': 'something ${xyz}' } as any;
        const performRemove = binder.createPerformForRemove(binding);

        await expect(performRemove).rejects.toThrowError(/xyz/);
        await expect(performRemove).rejects.toThrowError(/LocalPath/);
    });

    test('exception is thrown for unresolved remotePath', async () => {
        task.remotePath = { 'Fn::Sub': 'something ${xyz}' } as any;
        const performRemove = binder.createPerformForRemove(binding);

        await expect(performRemove).rejects.toThrowError(/xyz/);
        await expect(performRemove).rejects.toThrowError(/RemotePath/);
    });
});
