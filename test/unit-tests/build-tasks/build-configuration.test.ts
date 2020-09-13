import Sinon from 'sinon';
import { IBuildTask, IBuildFile, IBuildTaskConfiguration, BuildConfiguration, IBuildFileParameter } from '~build-tasks/build-configuration';
import { BuildTaskProvider } from '~build-tasks/build-task-provider';
import { IUpdateStacksCommandArgs, UpdateStacksCommand } from '~commands/update-stacks';
import { ConsoleUtil } from '~util/console-util';
import { IUpdateStackTaskConfiguration } from '~build-tasks/tasks/update-stacks-task';
import { IPerformTasksCommandArgs } from '~commands/index';
import { assert } from 'console';



describe('when resolving tasks from configuration', () => {
    let buildFile: any | IBuildFile;
    let filePath = './tasks.yml';

    beforeEach(() => {
        buildFile = {
            task1: {
                Type: 'task',
                Attrib1: 'value1',
                Attrib2: 2,
                Complex: {
                    CAttrib1: 'val1',
                    CAttrib2: 2,
                }

            }
        };
        jest.spyOn(BuildConfiguration.prototype, 'loadBuildFile').mockReturnValue(buildFile);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    })
    test('tasks without parameters resolve', () => {
        const config = new BuildConfiguration(filePath, {});
        expect(config.tasks).toBeDefined();
        expect(config.tasks.length).toBe(1);
        const task = config.tasks[0] as any;
        expect(task.Type).toBe('task');
        expect(task.Attrib1).toBe('value1');
        expect(task.Attrib2).toBe(2);
        expect(task.Complex.CAttrib1).toBe('val1');
        expect(task.Complex.CAttrib2).toBe(2);
    });

    test('task with string parameter and default value resolves', () => {
        buildFile.Parameters = { paramWithDefault : { Type: 'String', Default: 'hello'} as IBuildFileParameter };
        buildFile.task1.param = { Ref : 'paramWithDefault'};
        const config = new BuildConfiguration(filePath, {});
        expect(config.tasks).toBeDefined();
        expect(config.tasks.length).toBe(1);
        const task = config.tasks[0] as any;
        expect(task.param).toBe('hello');

    })
    test('task with numeric parameter and default value resolves', () => {
        buildFile.Parameters = { paramWithDefault : { Type: 'Number', Default: '2'} as IBuildFileParameter };
        buildFile.task1.param = { Ref : 'paramWithDefault'};
        const config = new BuildConfiguration(filePath, {});
        expect(config.tasks).toBeDefined();
        expect(config.tasks.length).toBe(1);
        const task = config.tasks[0] as any;
        expect(task.param).toBe(2);

    })

    test('task with boolean parameter and default value true resolves', () => {
        buildFile.Parameters = { paramWithDefault : { Type: 'Boolean', Default: 'true'} as IBuildFileParameter };
        buildFile.task1.param = { Ref : 'paramWithDefault'};
        const config = new BuildConfiguration(filePath, {});
        expect(config.tasks).toBeDefined();
        expect(config.tasks.length).toBe(1);
        const task = config.tasks[0] as any;
        expect(task.param).toBe(true);

    })

    test('task with boolean parameter and default value false resolves', () => {
        buildFile.Parameters = { paramWithDefault : { Type: 'Boolean', Default: 'false'} as IBuildFileParameter };
        buildFile.task1.param = { Ref : 'paramWithDefault'};
        const config = new BuildConfiguration(filePath, {});
        expect(config.tasks).toBeDefined();
        expect(config.tasks.length).toBe(1);
        const task = config.tasks[0] as any;
        expect(task.param).toBe(false);
    });


    test('task with parameter and default value can be overwritten by passing parameters', () => {
        buildFile.Parameters = { paramWithDefault : { Type: 'String', Default: 'default'} as IBuildFileParameter };
        buildFile.task1.param = { Ref : 'paramWithDefault'};
        const config = new BuildConfiguration(filePath, {paramWithDefault: 'overridden'});
        expect(config.tasks).toBeDefined();
        expect(config.tasks.length).toBe(1);
        const task = config.tasks[0] as any;
        expect(task.param).toBe('overridden');
    });

    test('task with numeric parameter and default value can be overwritten by passing parameters', () => {
        buildFile.Parameters = { paramWithDefault : { Type: 'Number', Default: '2'} as IBuildFileParameter };
        buildFile.task1.param = { Ref : 'paramWithDefault'};
        const config = new BuildConfiguration(filePath, {paramWithDefault: '4'});
        expect(config.tasks).toBeDefined();
        expect(config.tasks.length).toBe(1);
        const task = config.tasks[0] as any;
        expect(task.param).toBe(4);

    })

    test('task with boolean parameter and default value true can be overwritten by passing parameters', () => {
        buildFile.Parameters = { paramWithDefault : { Type: 'Boolean', Default: 'true'} as IBuildFileParameter };
        buildFile.task1.param = { Ref : 'paramWithDefault'};
        const config = new BuildConfiguration(filePath, {'paramWithDefault': 'false'});
        expect(config.tasks).toBeDefined();
        expect(config.tasks.length).toBe(1);
        const task = config.tasks[0] as any;
        expect(task.param).toBe(false);

    })

    test('task with boolean parameter and default value false can be overwritten by passing parameters', () => {
        buildFile.Parameters = { paramWithDefault : { Type: 'Boolean', Default: 'false'} as IBuildFileParameter };
        buildFile.task1.param = { Ref : 'paramWithDefault'};
        const config = new BuildConfiguration(filePath, {'paramWithDefault': 'true'});
        expect(config.tasks).toBeDefined();
        expect(config.tasks.length).toBe(1);
        const task = config.tasks[0] as any;
        expect(task.param).toBe(true);
    });


    test('parameter that does not have value will throw ', () => {
        buildFile.Parameters = { paramWithoutVal : { Type: 'String' } as IBuildFileParameter };

        expect( () => new BuildConfiguration(filePath, {})).toThrowError(/paramWithoutVal/);
    });

    test('parameter of unsupported type will throw ', () => {
        buildFile.Parameters = { paramWithoutVal : { Type: 'MyType' } as IBuildFileParameter };

        expect( () => new BuildConfiguration(filePath, {})).toThrowError(/MyType/);
    });


})

describe('when creating build configuration with duplicate stack name', () => {
    let task: IBuildTask;
    let updateStacksResources: sinon.SinonStub;
    const sandbox = Sinon.createSandbox();
    beforeEach(() => {
        const config: IUpdateStackTaskConfiguration = {
            Type: 'update-stacks',
            StackName: 'stack',
            Template: 'path.yml',
            FilePath: './.',
            LogicalName: 'task',
            MaxConcurrentStacks: 1,
            FailedStackTolerance: 1,
        };
        task = BuildTaskProvider.createBuildTask(config, {} as IPerformTasksCommandArgs);

        updateStacksResources = sandbox.stub(UpdateStacksCommand, 'Perform');
        sandbox.stub(ConsoleUtil, 'LogInfo')
    });

    afterEach(() => {
        sandbox.restore();
    });
    test('creates task', () => {
        expect(task).toBeDefined();
    });

    test('stack name is used for physicalIdForCleanup', () => {
        expect(task.physicalIdForCleanup).toBe('stack');
    });
    test('template and stack name are passed to updateStackResources', async () => {
        await task.perform();
        const commandArgs = updateStacksResources.lastCall.args[0] as IUpdateStacksCommandArgs;
        const fileArg = commandArgs.templateFile;
        const commandKeys = Object.keys(commandArgs);

        expect(fileArg.endsWith('path.yml')).toBe(true);
        expect(commandKeys.length).toBe(5);
        expect(commandKeys).toEqual(expect.arrayContaining(['stackName']));
        expect(commandArgs.stackName).toBe('stack');
    });
});
