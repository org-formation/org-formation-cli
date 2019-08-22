import { ICfnTask } from './cfn-task-provider';
export declare class CfnTaskRunner {
    static RunTasks(tasks: ICfnTask[]): Promise<void>;
}
