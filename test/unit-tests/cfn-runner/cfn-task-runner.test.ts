import { ICfnTask } from '../../../src/cfn-binder/cfn-task-provider';
import { CfnTaskRunner } from './../../../src/cfn-binder/cfn-task-runner';

describe('when running cfn tasks', () => {

    test('will run dependencies prior to dependend tasks', async () => {
        let order = 1;
        let task1order: number = 0;
        let task2order: number = 0;
        const task1: ICfnTask = {
            action: 'UpdateOrCreate',
            region: 'eu-central-1',
            accountId: '123123123123',
            stackName: 'task1',
            perform: async () => { task1order =  order; order = order + 1; },
            isDependency: () => false,
        };
        const task2: ICfnTask = {
            action: 'UpdateOrCreate',
            region: 'eu-central-1',
            accountId: '123123123123',
            stackName: 'task2',
            perform: async () => { task2order =  order; order = order + 1; },
            isDependency: (t) => t.stackName === 'task1',
        };
        await CfnTaskRunner.RunTasks([task2, task1], 'stack');
        expect(task1order).toBe(1);
        expect(task2order).toBe(2);
    });
    test('all tasks will exactly run once without dependencies', async () => {
        type MyTask = ICfnTask & { callCount: number};
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
        await CfnTaskRunner.RunTasks(tasks, 'stack');

        const notExactlyOnce = tasks.find((x) => x.callCount !== 1);
        expect(notExactlyOnce).toBeUndefined();
    });

    test('all tasks will exactly run once with dependencies', async () => {
        type MyTask = ICfnTask & { callCount: number};
        const tasks: MyTask[] = [];
        const task1: MyTask = {
            action: 'UpdateOrCreate',
            region: 'eu-central-1',
            accountId: '1000000000000' ,
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
        await CfnTaskRunner.RunTasks(tasks, 'stack');

        const notExactlyOnce = tasks.find((x) => x.callCount !== 1);
        expect(notExactlyOnce).toBeUndefined();
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
            await CfnTaskRunner.RunTasks([task1, task2], 'stack');
            throw new Error('expected error to have been thrown');
        } catch (err) {
            expect(err.message).toEqual(expect.stringContaining('circular dependency'));
            expect(err.message).toEqual(expect.stringContaining('123123123123'));
            expect(err.message).toEqual(expect.stringContaining('eu-central-1'));
        }
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
            await CfnTaskRunner.RunTasks([task1], 'stack');
            throw new Error('expected error to have been thrown');
        } catch (err) {
            expect(err.message).toEqual(expect.stringContaining('dependency on self'));
        }
    });
});

function createSleepPromise(timeout: number) {

    return new Promise((resolve) => {
        setTimeout(resolve, timeout);
    });
}
