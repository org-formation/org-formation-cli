import { IBuildTask } from './org-tasks-provider';
export declare class TaskRunner {
    static RunTasks(tasks: IBuildTask[]): Promise<void>;
}
