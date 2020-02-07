import { expect } from 'chai';
import { ICfnTask } from '../../../src/cfn-binder/cfn-task-provider';
import { CfnTaskRunner } from './../../../src/cfn-binder/cfn-task-runner';

describe('when running cfn tasks', () => {

    it('will run dependencies prior to dependend tasks', async () => {
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
        expect(task1order).to.eq(1);
        expect(task2order).to.eq(2);
    });
    it('all tasks will exactly run once without dependencies', async () => {
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
        expect(notExactlyOnce).to.be.undefined;
    });

    it('all tasks will exactly run once with dependencies', async () => {
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
        expect(notExactlyOnce).to.be.undefined;
    });

    it('will throw for circular dependency', async () => {
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
            expect(err.message).to.contain('circular dependency');
            expect(err.message).to.contain('123123123123');
            expect(err.message).to.contain('eu-central-1');
        }
    });

    it('will throw for dependency on self', async () => {
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
            expect(err.message).to.contain('dependency on self');
        }
    });

    it('will not run dependee after dependency failed', async () => {
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
        expect(task2.callCount).to.eq(0);
    });

    it('skipped task increases error count (and raises expection above threshold)', async () => {
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
            expect(err.message).to.contain('tolerance');
            expect(err.message).to.contain('2');
        }
    });
});

function createSleepPromise(timeout: number) {

    return new Promise((resolve) => {
        setTimeout(resolve, timeout);
    });
}
