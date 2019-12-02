import { expect } from 'chai';
import { ICfnTask } from '../../../src/cfn-binder/cfn-task-provider';
import { CfnTaskRunner } from './../../../src/cfn-binder/cfn-task-runner';

describe('when running cfn tasks', () => {

    it('will throw for circular dependency', async () => {
        const task1: ICfnTask = {
            action: 'UpdateOrCreate',
            dependentTaskFilter: (t) => t.stackName === 'task2',
            region: 'eu-central-1',
            accountId: '123123123123',
            stackName: 'task1',
            perform: async (x) => { return undefined; },
        };
        const task2: ICfnTask = {
            action: 'UpdateOrCreate',
            dependentTaskFilter: (t) => t.stackName === 'task1',
            region: 'eu-central-1',
            accountId: '123123123123',
            stackName: 'task2',
            perform: async (x) => { return undefined; },
        };
        try {
            await CfnTaskRunner.RunTasks([task1, task2], 'stack');
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
            dependentTaskFilter: (t) => true,
            region: 'eu-central-1',
            accountId: '123123123123',
            stackName: 'task1',
            perform: async (x) => { return undefined; },
        };
        try {
            await CfnTaskRunner.RunTasks([task1], 'stack');
            throw new Error('expected error to have been thrown');
        } catch (err) {
            expect(err.message).to.contain('dependency on self');
        }
    });
});
