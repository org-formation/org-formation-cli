import { ICfnTask } from '~cfn-binder/cfn-task-provider';
import { CfnTaskRunner } from '~cfn-binder/cfn-task-runner';
import Sinon from 'sinon';
import { ConsoleUtil } from '~util/console-util';

describe('when running cfn tasks', () => {
    let sandbox = Sinon.createSandbox();
    let consoleErr : Sinon.SinonStub;
    let consoleInfo : Sinon.SinonStub;

    beforeEach(() => {
        consoleErr = sandbox.stub(ConsoleUtil, 'LogError');
        consoleInfo = sandbox.stub(ConsoleUtil, 'LogInfo');
    });

    afterEach(() => {
        sandbox.restore();
    })

    test('will run dependencies prior to dependent tasks', async () => {
        let order = 1;
        let task1order: number = 0;
        let task2order: number = 0;
        const task1: ICfnTask = {
            action: 'UpdateOrCreate',
            region: 'eu-central-1',
            accountId: '123123123123',
            stackName: 'task1',
            perform: async () => { task1order = order; order = order + 1; },
            isDependency: () => false,
        };
        const task2: ICfnTask = {
            action: 'UpdateOrCreate',
            region: 'eu-central-1',
            accountId: '123123123123',
            stackName: 'task2',
            perform: async () => { task2order = order; order = order + 1; },
            isDependency: (t) => t.stackName === 'task1',
        };
        await CfnTaskRunner.RunTasks([task2, task1], 'stack', 1, 0);
        expect(task1order).toBe(1);
        expect(task2order).toBe(2);
        expect(consoleErr.callCount).toBe(0);
    });

    test('task with skip = true will not run', async () => {
        let order = 1;
        let task1order: number = 0;
        let task2order: number = 0;
        const task1: ICfnTask = {
            action: 'UpdateOrCreate',
            region: 'eu-central-1',
            accountId: '123123123123',
            skip: true,
            stackName: 'task1',
            perform: async () => { task1order = order; order = order + 1; },
            isDependency: () => false,
        };
        const task2: ICfnTask = {
            action: 'UpdateOrCreate',
            region: 'eu-central-1',
            accountId: '123123123123',
            stackName: 'task2',
            perform: async () => { task2order = order; order = order + 1; },
            isDependency: () => false,
        };
        await CfnTaskRunner.RunTasks([task2, task1], 'stack', 1, 0);
        expect(task1order).toBe(0);
        expect(task2order).toBe(1);
        expect(consoleErr.callCount).toBe(0);
    });

    test('all tasks will exactly run once without dependencies', async () => {
        type MyTask = ICfnTask & { callCount: number };
        const tasks: MyTask[] = [];
        for (let x = 0; x <= 9; x++) {
            const task: MyTask = {
                action: 'UpdateOrCreate',
                region: 'eu-central-1',
                accountId: '100000000000' + x,
                stackName: 'task' + x,
                callCount: 0,
                perform: async () => { task.callCount = task.callCount + 1; await createSleepPromise(10 - x); },
                isDependency: () => false,
            };
            tasks.push(task);
        }
        await CfnTaskRunner.RunTasks(tasks, 'stack', 1, 0);

        const notExactlyOnce = tasks.find((x) => x.callCount !== 1);
        expect(notExactlyOnce).toBeUndefined();
        expect(consoleErr.callCount).toBe(0);
    });

    test('all tasks will exactly run once with dependencies', async () => {
        type MyTask = ICfnTask & { callCount: number };
        const tasks: MyTask[] = [];
        const task1: MyTask = {
            action: 'UpdateOrCreate',
            region: 'eu-central-1',
            accountId: '1000000000000',
            stackName: 'task1',
            callCount: 0,
            perform: async () => { task1.callCount = task1.callCount + 1; await createSleepPromise(10); },
            isDependency: () => false,
        };
        tasks.push(task1);
        for (let x = 2; x <= 10; x++) {
            const task: MyTask = {
                action: 'UpdateOrCreate',
                isDependency: (t) => t.stackName === 'task' + (x - 1),
                region: 'eu-central-1',
                accountId: '100000000000' + x,
                stackName: 'task' + x,
                callCount: 0,
                perform: async () => { task.callCount = task.callCount + 1; await createSleepPromise(10 - x); },
            };
            tasks.push(task);
        }
        await CfnTaskRunner.RunTasks(tasks, 'stack', 1, 0);

        const notExactlyOnce = tasks.find((x) => x.callCount !== 1);
        expect(notExactlyOnce).toBeUndefined();
        expect(consoleErr.callCount).toBe(0);
    });

    test('will throw for circular dependency', async () => {
        const task1: ICfnTask = {
            action: 'UpdateOrCreate',
            isDependency: (t) => t.stackName === 'task2',
            region: 'eu-central-1',
            accountId: '123123123123',
            stackName: 'task1',
            perform: async () => { return undefined; },
        };
        const task2: ICfnTask = {
            action: 'UpdateOrCreate',
            isDependency: (t) => t.stackName === 'task1',
            region: 'eu-central-1',
            accountId: '123123123123',
            stackName: 'task2',
            perform: async () => { return undefined; },
        };
        try {
            await CfnTaskRunner.RunTasks([task1, task2], 'stack', 1, 0);
            throw new Error('expected error to have been thrown');
        } catch (err) {
            expect(err.message).toEqual(expect.stringContaining('Circular dependency'));
            expect(err.message).toEqual(expect.stringContaining('123123123123'));
            expect(err.message).toEqual(expect.stringContaining('eu-central-1'));
        }
        expect(consoleErr.callCount).toBe(8);
    });

    test('will throw for dependency on self', async () => {
        const task1: ICfnTask = {
            action: 'UpdateOrCreate',
            isDependency: (t) => true,
            region: 'eu-central-1',
            accountId: '123123123123',
            stackName: 'task1',
            perform: async () => { return undefined; },
        };
        try {
            await CfnTaskRunner.RunTasks([task1], 'stack', 1, 0);
            throw new Error('expected error to have been thrown');
        } catch (err) {
            expect(err.message).toEqual(expect.stringContaining('dependency on self'));
        }
        expect(consoleErr.callCount).toBe(7);
    });

    test('will skip task if dependent is skipped', async () => {
        let order = 1;
        let task1order: number = 0;
        let task2order: number = 0;
        const task1: ICfnTask = {
            action: 'UpdateOrCreate',
            region: 'eu-central-1',
            accountId: '123123123123',
            skip: true,
            stackName: 'task1',
            perform: async () => { task1order = order; order = order + 1; },
            isDependency: () => false,
        };
        const task2: ICfnTask = {
            action: 'UpdateOrCreate',
            region: 'eu-central-1',
            skip: false,
            accountId: '123123123123',
            stackName: 'task2',
            perform: async () => { task2order = order; order = order + 1; },
            isDependency:  (t) => t.stackName === 'task1',
        };
        await CfnTaskRunner.RunTasks([task2, task1], 'stack', 1, 0);
        expect(task1order).toBe(0);
        expect(task2order).toBe(0);
        expect(consoleErr.callCount).toBe(0);
        expect(consoleInfo.getCall(1).args[0]).toContain('Overriding skipping configuration for task');
    });
    test('will not run dependent after dependency failed', async () => {
        type MyTask = ICfnTask & { callCount: number };
        const task1: MyTask = {
            action: 'UpdateOrCreate',
            isDependency: (t) => false,
            region: 'eu-central-1',
            accountId: '123123123123',
            stackName: 'task1',
            callCount: 0,
            perform: async () => { task1.callCount += 1; throw new Error('failed'); },
        };
        const task2: MyTask = {
            action: 'UpdateOrCreate',
            isDependency: (t) => t.stackName === 'task1',
            region: 'eu-central-1',
            accountId: '123123123123',
            stackName: 'task2',
            callCount: 0,
            perform: async () => { task2.callCount += 1; },
        };
        await CfnTaskRunner.RunTasks([task1, task2], 'stack', 10, 10);
        expect(task2.callCount).toEqual(0);
        expect(consoleErr.callCount).toBe(1);
        expect(consoleErr.getCall(0).args[0]).toContain('task1');
        expect(consoleErr.getCall(0).args[0]).toContain('123123123123');
        expect(consoleErr.getCall(0).args[0]).toContain('failed');
    });

    test('dependency on failed task increases error count (and raises exception above threshold)', async () => {
        type MyTask = ICfnTask & { callCount: number };
        const task1: MyTask = {
            action: 'UpdateOrCreate',
            isDependency: (t) => false,
            region: 'eu-central-1',
            accountId: '123123123123',
            stackName: 'task1',
            callCount: 0,
            perform: async () => { task1.callCount += 1; throw new Error('failed'); },
        };
        const task2: MyTask = {
            action: 'UpdateOrCreate',
            isDependency: (t) => t.stackName === 'task1',
            region: 'eu-central-1',
            accountId: '123123123123',
            stackName: 'task2',
            callCount: 0,
            perform: async () => { task2.callCount += 1; },
        };
        try {
            await CfnTaskRunner.RunTasks([task1, task2], 'stack', 10, 1);
            throw new Error('expected error to have been thrown');
        } catch (err) {
            expect(err.message).toContain('tolerance');
            expect(err.message).toContain('2');
        }
        expect(consoleErr.callCount).toBe(9);
        expect(consoleErr.getCall(0).args[0]).toContain('task1');
        expect(consoleErr.getCall(0).args[0]).toContain('123123123123');
        expect(consoleErr.getCall(0).args[0]).toContain('failed');
    });


    test('dependency on failed and explicitly skipped task does not increases error count', async () => {
        type MyTask = ICfnTask & { callCount: number };
        const task1: MyTask = {
            action: 'UpdateOrCreate',
            isDependency: (t) => false,
            region: 'eu-central-1',
            accountId: '123123123123',
            stackName: 'task1',
            callCount: 0,
            perform: async () => { task1.callCount += 1; throw new Error('failed'); },
        };
        const task2: MyTask = {
            action: 'UpdateOrCreate',
            isDependency: (t) => false,
            skip: true,
            region: 'eu-central-1',
            accountId: '123123123123',
            stackName: 'task2',
            callCount: 0,
            perform: async () => { task2.callCount += 1; },
        };
        const task3: MyTask = {
            action: 'UpdateOrCreate',
            isDependency: (t) => t.stackName !== 'task3',
            region: 'eu-central-1',
            accountId: '123123123123',
            stackName: 'task4',
            callCount: 0,
            perform: async () => { task2.callCount += 1; },
        };
        await CfnTaskRunner.RunTasks([task1, task2], 'stack', 10, 1);

        expect(consoleErr.getCall(0).args[0]).toContain('task1');
        expect(consoleErr.getCall(0).args[0]).toContain('123123123123');
        expect(consoleErr.getCall(0).args[0]).toContain('failed');
    });
});

function createSleepPromise(timeout: number) {

    return new Promise((resolve) => {
        setTimeout(resolve, timeout);
    });
}
