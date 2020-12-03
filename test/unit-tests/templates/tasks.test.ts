import { BuildConfiguration, IBuildTask } from '~build-tasks/build-configuration';
import { BaseOrganizationTask } from '~build-tasks/tasks/organization-task';
import { BaseCliCommand } from '~commands/base-command';
import Sinon = require('sinon');
import { CfnTaskRunner } from '~cfn-binder/cfn-task-runner';
import { PersistedState } from '~state/persisted-state';
import { OrgResourceTypes } from '~parser/model/resource-types';
import { ICfnTask } from '~cfn-binder/cfn-task-provider';
import { ConsoleUtil } from '~util/console-util';
import { IPerformTasksCommandArgs } from '~commands/index';
import { IUpdateStacksBuildTask } from '~build-tasks/tasks/update-stacks-task';

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

    test('include tasks have child tasks', () => {
        const tasks = buildconfig.enumBuildTasks({} as any);
        const includes = tasks.filter((x) => x.type === 'include');
        expect(includes[0].childTasks.length).toBe(2);
        expect(includes[1].childTasks.length).toBe(2);
    });
});

describe('when getting build tasks for task file without update-organization', () => {

    test('then error is thrown', () => {
        try {
            const config = new BuildConfiguration('./test/resources/tasks/build-tasks-empty.yml');
            config.enumBuildTasks({} as IPerformTasksCommandArgs);
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
            config.enumValidationTasks({} as IPerformTasksCommandArgs);
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
            config.enumValidationTasks({} as IPerformTasksCommandArgs);
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
            config.enumBuildTasks({} as IPerformTasksCommandArgs);
            throw new Error('expected error to have been thrown');
        } catch (err) {
            expect(err.message).toEqual(expect.stringContaining('stackName'));
            expect(err.message).toEqual(expect.stringContaining('stack-name'));
        }
    });
});

describe('when getting build tasks for task file with duplicate stackName through include', () => {
    test('then error is thrown', () => {
        try {
            const config = new BuildConfiguration('./test/resources/tasks/build-tasks-include-with-duplicate.yml');
            config.enumBuildTasks({} as IPerformTasksCommandArgs);
            throw new Error('expected error to have been thrown');
        } catch (err) {
            expect(err.message).toEqual(expect.stringContaining('stackName'));
            expect(err.message).toEqual(expect.stringContaining('stack-name'));
        }
    });
});

describe('when getting validation tasks for task file with duplicate stackName through include', () => {

    test('then error is thrown', () => {
        try {
            const config = new BuildConfiguration('./test/resources/tasks/build-tasks-include-with-duplicate.yml');
            config.enumValidationTasks({} as IPerformTasksCommandArgs);
            throw new Error('expected error to have been thrown');
        } catch (err) {
            expect(err.message).toEqual(expect.stringContaining('stackName'));
            expect(err.message).toEqual(expect.stringContaining('stack-name'));
        }
    });
});


describe('when getting build tasks for task file with duplicate stackName through nested includes', () => {
    test('then error is thrown', () => {
        try {
            const config = new BuildConfiguration('./test/resources/tasks/build-tasks-include-with-duplicate-nested.yml');
            config.enumBuildTasks({} as IPerformTasksCommandArgs);
            throw new Error('expected error to have been thrown');
        } catch (err) {
            expect(err.message).toEqual(expect.stringContaining('stackName'));
            expect(err.message).toEqual(expect.stringContaining('stack-name'));
        }
    });
});

describe('when getting validation tasks for task file with duplicate stackName through nested includes', () => {
    test('then error is thrown', () => {
        try {
            const config = new BuildConfiguration('./test/resources/tasks/build-tasks-include-with-duplicate-nested.yml');
            config.enumValidationTasks({} as IPerformTasksCommandArgs);
            throw new Error('expected error to have been thrown');
        } catch (err) {
            expect(err.message).toEqual(expect.stringContaining('stackName'));
            expect(err.message).toEqual(expect.stringContaining('stack-name'));
        }
    });
});

describe('when including task file with update-organization', () => {
    test('then error is thrown', () => {
        try {
            const config = new BuildConfiguration('./test/resources/tasks/build-tasks-include-with-update-org.yml');
            config.enumValidationTasks({} as IPerformTasksCommandArgs);
            throw new Error('expected error to have been thrown');
        } catch (err) {
            expect(err.message).toEqual(expect.stringContaining('multiple update-organization tasks found'));
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

});

describe('when referencing account on parameter', () => {
    let buildconfig: BuildConfiguration;
    let tasks: IBuildTask[];
    let runTask: Sinon.SinonStub;
    const sandbox = Sinon.createSandbox();

    beforeEach(() => {
        buildconfig = new BuildConfiguration('./test/resources/tasks/build-tasks-param-account-ref.yml');
        tasks = buildconfig.enumBuildTasks({maxConcurrentStacks: 1, failedStacksTolerance: 0, maxConcurrentTasks: 1, failedTasksTolerance: 0 } as any);
        const getState = sandbox.stub(BaseCliCommand.prototype, 'getState');
        const state = PersistedState.CreateEmpty('000000000000');
        state.setBinding({
            logicalId: 'Account1',
            physicalId: '111111111111',
            lastCommittedHash: 'aabbcc',
            type: OrgResourceTypes.Account
        });
        state.setBinding({
            logicalId: 'Account2',
            physicalId: '222222222222',
            lastCommittedHash: 'aabbcc',
            type: OrgResourceTypes.Account
        });
        getState.returns(Promise.resolve(state));
        runTask = sandbox.stub(CfnTaskRunner, 'RunTasks');
        sandbox.stub(PersistedState.prototype, 'save');
        sandbox.stub(ConsoleUtil, 'LogInfo');
    });

    afterEach(() => {
        sandbox.restore();
    })

    test('file is loaded without errors', () => {
        expect(tasks).toBeDefined();
        expect(tasks.length).toBe(3);
        const updateStacks = tasks.filter((x) => x.type === 'update-stacks');
        expect(updateStacks.length).toBe(2);
    });

    test('account from param is part of binding', async () => {
        const updateStacksAccount1 = tasks.filter((x) => x.type === 'update-stacks' && x.name === 'StackParamAccount1Ref')[0] as IUpdateStacksBuildTask;
        await updateStacksAccount1.perform();
        expect(runTask.callCount).toBe(1);
        const taskRan: ICfnTask[] = runTask.getCall(0).args[0];
        expect(taskRan.length).toBe(2);
        expect(taskRan.find(x=>x.accountId = '111111111111')).toBeDefined();
        expect(taskRan.find(x=>x.accountId = '222222222222')).toBeDefined();
    });
});

describe('when referencing non-existing task using DependsOns', () => {
    let buildconfig: BuildConfiguration;
    const sandbox = Sinon.createSandbox();
    let stub: Sinon.SinonStub;
    beforeEach(() => {
        stub = sandbox.stub(ConsoleUtil, 'LogWarning');
        buildconfig = new BuildConfiguration('./test/resources/tasks/task-depends-on-non-existing.yml');
    });

    test('file is loaded without errors', () => {
        const tasks = buildconfig.enumBuildTasks({} as any);
        expect(tasks).toBeDefined();
        expect(tasks.length).toBe(2);
        const updateStacks = tasks.filter((x) => x.type === 'update-stacks');
        expect(updateStacks.length).toBe(1);
    });

    test('warning is logged', () => {
        const tasks = buildconfig.enumBuildTasks({} as any);
        expect(stub.callCount).toBe(1);
    })

    afterEach(() => {
        sandbox.restore();
    })
});