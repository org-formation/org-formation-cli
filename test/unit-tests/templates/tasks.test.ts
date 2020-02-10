import { BuildConfiguration, IBuildTask } from '../../../src/build-tasks/build-configuration';
import { BaseOrganizationTask, BaseStacksTask } from '../../../src/build-tasks/build-task-provider';
import { ICommandArgs } from '../../../src/commands/base-command';

describe('when loading task file configuration', () => {
    let buildconfig: BuildConfiguration;

    beforeEach(() => {
        buildconfig = new BuildConfiguration('./test/resources/tasks/build-tasks.yml');
    });

    test('loads build configuration', () => {
        expect(buildconfig).toBeDefined();
    });

    test('has configuration per task', () => {
        expect(buildconfig.tasks.length).toBe(5);
        expect(buildconfig.tasks.find((x) => x.LogicalName === 'CfnTemplate')).toBeDefined();
        expect(buildconfig.tasks.find((x) => x.LogicalName === 'OrgTemplate')).toBeDefined();
        expect(buildconfig.tasks.find((x) => x.LogicalName === 'OrganizationUpdate')).toBeDefined();
        expect(buildconfig.tasks.find((x) => x.LogicalName === 'Include1')).toBeDefined();
        expect(buildconfig.tasks.find((x) => x.LogicalName === 'Include2')).toBeDefined();
    });

    test('all tasks have FilePath', () => {
        const withoutFileName = buildconfig.tasks.find((x) => !x.FilePath);
        expect(withoutFileName).toBeUndefined();
    });
});

describe('when enumerating build tasks', () => {
    let buildconfig: BuildConfiguration;

    beforeEach(() => {
        buildconfig = new BuildConfiguration('./test/resources/tasks/build-tasks.yml');
    });

    test('every build config gets a task', () => {
        const tasks = buildconfig.enumBuildTasks({} as any);
        expect(tasks).toBeDefined();
        expect(tasks.length).toBe(5);
        expect(tasks.filter((x) => x.type === 'include').length).toBe(2);
        expect(tasks.filter((x) => x.type === 'update-stacks').length).toBe(2);
        expect(tasks.filter((x) => x.type === 'update-organization').length).toBe(1);
    });
});

describe('when getting build tasks for task file without update-organization', () => {

    test('then error is thrown', () => {
        try {
            const config = new BuildConfiguration('./test/resources/tasks/build-tasks-empty.yml');
            config.enumBuildTasks({} as ICommandArgs);
            throw new Error('expected error to have been thrown');
        } catch (err) {
            expect(err.message).toEqual(expect.stringContaining('update-organization'));
        }
    });
});

describe('when getting validation tasks for task file without update-organization', () => {

    test('then error is thrown', () => {
        try {
            const config = new BuildConfiguration('./test/resources/tasks/build-tasks-empty.yml');
            config.enumValidationTasks({} as ICommandArgs);
            throw new Error('expected error to have been thrown');
        } catch (err) {
            expect(err.message).toEqual(expect.stringContaining('update-organization'));
        }
    });
});

describe('when getting validation tasks for task file with duplicate stackName', () => {

    test('then error is thrown', () => {
        try {
            const config = new BuildConfiguration('./test/resources/tasks/build-tasks-duplicate-stackname.yml');
            config.enumValidationTasks({} as ICommandArgs);
            throw new Error('expected error to have been thrown');
        } catch (err) {
            expect(err.message).toEqual(expect.stringContaining('stackName'));
            expect(err.message).toEqual(expect.stringContaining('stack-name'));
        }
    });
});

describe('when getting build tasks for task file with duplicate stackName', () => {

    test('then error is thrown', () => {
        try {
            const config = new BuildConfiguration('./test/resources/tasks/build-tasks-duplicate-stackname.yml');
            config.enumBuildTasks({} as ICommandArgs);
            throw new Error('expected error to have been thrown');
        } catch (err) {
            expect(err.message).toEqual(expect.stringContaining('stackName'));
            expect(err.message).toEqual(expect.stringContaining('stack-name'));
        }
    });
});

describe('when including task file without update-organization', () => {
    let buildconfig: BuildConfiguration;

    beforeEach(() => {
        buildconfig = new BuildConfiguration('./test/resources/tasks/build-tasks-include-empty.yml');
    });

    test('file is loaded without errors', () => {
        const tasks = buildconfig.enumBuildTasks({} as any);
        expect(tasks).toBeDefined();
        expect(tasks.length).toBe(2);
        expect(tasks.filter((x) => x.type === 'include').length).toBe(1);
        expect(tasks.filter((x) => x.type === 'update-organization').length).toBe(1);
    });

    test('organization file path is passed to included file ', () => {
        const tasks = buildconfig.enumBuildTasks({} as any);
        const includeTask = tasks.filter((x) => x.type === 'include')[0];
        const updateOrgTask = tasks.filter((x) => x.type === 'update-organization')[0];
        const command = (includeTask as any).command;
        expect(command).toBeDefined();
        expect(command.organizationFile).toBeDefined();
        expect(command.organizationFile as string).toEqual(
            expect.stringContaining((updateOrgTask as BaseOrganizationTask).templatePath)
        );


    });
});

describe('when referencing account on parameter', () => {
    let buildconfig: BuildConfiguration;
    let tasks: IBuildTask[];

    beforeEach(() => {
        buildconfig = new BuildConfiguration('./test/resources/tasks/build-tasks-param-account-ref.yml');
        tasks = buildconfig.enumBuildTasks({} as any);
    });

    test('file is loaded without errors', () => {
        expect(tasks).toBeDefined();
        expect(tasks.length).toBe(3);
        const updateStacks = tasks.filter((x) => x.type === 'update-stacks');
        expect(updateStacks.length).toBe(2);
    });

    // it('physical id of account is copied to parameter value', () => {
    //     const updateStacksAccount1 = tasks.filter((x) => x.type === 'update-stacks' && x.name === 'StackParamAccount1Ref')[0] as BaseStacksTask;

    //     expect(updateStacksAccount1);
    // });
});
