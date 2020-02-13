import { OrgFormationError } from '../org-formation-error';

export class GenericTaskRunner {

    public static async RunTasks<TTask>(tasks: IGenericTaskInternal<TTask>[], delegate: ITaskRunnerDelegates<TTask>) {
        let totalTasksRan = 0;
        let totalTasksFailed = 0;
        let remainingTasks: IGenericTaskInternal<TTask>[] = tasks;
        let tasksWithDependencies: IGenericTaskInternal<TTask>[] = [];
        let runningTasks: IGenericTaskInternal<TTask>[] = [];
        const allFailedTasks: IGenericTaskInternal<TTask>[] = [];
        let runningTaskPromises: Promise<void>[] = [];
        do {
            for (const task of remainingTasks) {
                if (task.isDependency(task)) {
                    delegate.throwDependencyOnSelfException(task);
                }

                const dependencies = remainingTasks.filter(x => task.isDependency(x));
                if (dependencies.length > 0) {
                    tasksWithDependencies.push(task);
                    continue;
                }

                const failedDepdency = allFailedTasks.filter(x => task.isDependency(x));
                if (failedDepdency.length > 0) {
                    totalTasksRan += 1;
                    totalTasksFailed += 1;
                    allFailedTasks.push(task);
                    if (totalTasksFailed > delegate.failedTasksTolerance) {
                        delegate.onFailureToleranceExceeded(totalTasksFailed, delegate.failedTasksTolerance);
                    }
                    continue;
                }

                if (runningTasks.length >= delegate.maxConcurrentTasks) {
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
            const failedTasks = runningTasks.filter(x => x.failed === true);
            totalTasksFailed = failedTasks.length;
            allFailedTasks.push(...failedTasks);
            if (totalTasksFailed > delegate.failedTasksTolerance) {
                delegate.onFailureToleranceExceeded(totalTasksFailed, delegate.failedTasksTolerance);
            }
            runningTasks = [];
            runningTaskPromises = [];
            remainingTasks = tasksWithDependencies;
            tasksWithDependencies = [];
        } while (remainingTasks.length > 0);

    }

    private static async performTask<TTask>(task: IGenericTaskInternal<TTask>, delegate: ITaskRunnerDelegates<TTask>): Promise<void> {
        let retryWhenRateLimited = false;
        let retryAttemptRateLimited = 0;
        do {
            try {
                retryWhenRateLimited = false;
                task.running = true;
                task.promise  = task.perform();
                await task.promise;
                task.done = true;
                task.failed = false;
                task.running = false;
                delegate.onTaskRanSuccessfully(task);
            } catch (err) {
                if ((err.code === 'Throttling' || err.code === 'OptInRequired') && retryAttemptRateLimited < 5)  {
                    retryWhenRateLimited = true;
                    retryAttemptRateLimited = retryAttemptRateLimited + 1;
                    await sleep(Math.pow(retryAttemptRateLimited, 2) + Math.random());
                    continue;
                }
                task.done = true;
                task.failed = true;
                task.running = false;
                delegate.onTaskRanFailed(task, err);
            }
        } while (retryWhenRateLimited);
    }
}

export interface ITaskRunnerDelegates<TTask> {
    maxConcurrentTasks: number;
    failedTasksTolerance: number;
    onFailureToleranceExceeded(totalTasksFailed: number, failedTasksTolerance: number): void;
    onTaskRanFailed(task: IGenericTaskInternal<TTask>, err: any): void;
    onTaskSkippedBecauseDependencyFailed(task: IGenericTaskInternal<TTask>): void;
    onTaskRanSuccessfully(task: IGenericTaskInternal<TTask>): void;
    throwDependencyOnSelfException(task: IGenericTaskInternal<TTask>): void;
    throwCircularDependency(tasks: IGenericTaskInternal<TTask>[]): void;
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

async function sleep(seconds: number) {
    return new Promise(resolve => {
        setTimeout(resolve, seconds * 1000);
    });
}
