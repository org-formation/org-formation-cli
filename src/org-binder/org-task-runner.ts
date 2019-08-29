import { IBuildTask } from './org-tasks-provider';

export class TaskRunner {

    public static async RunTasks(tasks: IBuildTask[]) {
        for (const task of tasks) {
            try {
                console.log(`executing task: ${task.action} ${task.type} ${task.logicalId}`);
                await task.perform(task);
                console.log(`result = ${task.result}`);
            } catch (err) {
                console.log(`failed executing task: ${task.action} ${task.type} ${task.logicalId} ${err}`);
                throw err;
            }
        }
    }

    public static CreateChangeSet(tasks: IBuildTask[], changeSetName: string): IOrganizationChangeSet {
        const includedChangeActions = ['CommitHash'];

        return {
            changeSetName,
            changes: tasks.filter((x) => includedChangeActions.indexOf(x.action) === -1)
                          .map((x) => ({
                            logicalId: x.logicalId,
                            type: x.type,
                            action: x.action,
                           })),
        };
    }
}

export interface IOrganizationChangeSet {
    changeSetName: string;
    changes: IOrganizationChange[];
}

export interface IOrganizationChange {
    logicalId: string;
    action: string;
    type: string;
}
