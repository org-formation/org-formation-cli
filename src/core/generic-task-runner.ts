export class GenericTaskRunner {

    public static async RunTasks<TTask>(tasks: Array<IGenericTaskInternal<TTask>>, delegate: ITaskRunnerDelegates<TTask>) {
        let totalTasksRan = 0;
        let remainingTasks: Array<IGenericTaskInternal<TTask>> = tasks;
        let tasksWithDependencies: Array<IGenericTaskInternal<TTask>> = [];
        let runningTasks: Array<IGenericTaskInternal<TTask>> = [];
        let runningTaskPromises: Array<Promise<void>> = [];
        do {
            for (const task of remainingTasks) {
                if (task.isDependency(task)) {
                    delegate.throwDependencyOnSelfException(task);
                }

                const dependencies = remainingTasks.filter((x) => task.isDependency(x));
                if (dependencies.length > 0) {
                    tasksWithDependencies.push(task);
                    continue;
                }

                if (runningTasks.length >= delegate.maxNumberOfTasks) {
                    tasksWithDependencies.push(task);
                    continue;
                }
                const taskPromise = GenericTaskRunner.performTask(task, delegate);
                runningTaskPromises.push(taskPromise);
                runningTasks.push(task);
            }

            if (runningTasks.length === 0 && tasksWithDependencies.length > 0) {
                delegate.throwCircularDependency(tasksWithDependencies);
            }
            await Promise.all(runningTaskPromises);
            totalTasksRan = totalTasksRan + runningTasks.length;
            runningTasks = [];
            runningTaskPromises = [];
            remainingTasks = tasksWithDependencies;
            tasksWithDependencies = [];
        } while (remainingTasks.length > 0);

    }

    private static async performTask<TTask>(task: IGenericTaskInternal<TTask>, delegate: ITaskRunnerDelegates<TTask>): Promise<void> {
        try {
            task.running = true;
            task.promise  = task.perform();
            await task.promise;
            task.done = true;
            task.failed = false;
            task.running = false;
            delegate.onTaskRanSuccessfully(task);

        } catch (err) {
            task.done = true;
            task.failed = true;
            task.running = false;
            delegate.onTaskRanFailed(task, err);
        }
    }
}

export interface ITaskRunnerDelegates<TTask> {
    maxNumberOfTasks: number;
    onTaskRanFailed(task: IGenericTaskInternal<TTask>, err: any): void;
    onTaskRanSuccessfully(task: IGenericTaskInternal<TTask>): void;
    throwDependencyOnSelfException(task: IGenericTaskInternal<TTask>): void;
    throwCircularDependency(tasks: Array<IGenericTaskInternal<TTask>>): void;
}

export type IGenericTaskInternal<TTask> = IGenericTask<TTask> & IGenericTaskState & TTask;

export interface IGenericTask<TTask> {
    isDependency(task: TTask): boolean;
    perform(): Promise<void>;
}

export interface IGenericTaskState {
    done?: boolean;
    failed?: boolean;
    running?: boolean;
    promise?: Promise<void>;
}
