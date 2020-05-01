import { ConsoleUtil } from '~util/console-util';
import { OrgFormationError } from '~org-formation-error';

export class GenericTaskRunner {

    public static async RunTasks<TTask>(tasks: IGenericTaskInternal<TTask>[], delegate: ITaskRunnerDelegates<TTask>): Promise<void> {
        let remainingTasks: IGenericTaskInternal<TTask>[] = tasks;
        let tasksWithDependencies: IGenericTaskInternal<TTask>[] = [];
        let runningTasks: IGenericTaskInternal<TTask>[] = [];
        const tasksFailed: IGenericTaskInternal<TTask>[] = [];
        let runningTaskPromises: Promise<void>[] = [];

        try {
            do {
                for (const task of remainingTasks) {
                    if (task.isDependency(task)) {
                        throw new OrgFormationError(`${delegate.getName(task)} has dependency on self.`);
                    }

                    const dependencies = remainingTasks.filter(x => task.isDependency(x));
                    if (dependencies.length > 0) {
                        tasksWithDependencies.push(task);
                        continue;
                    }

                    const failedDependency = tasksFailed.filter(x => task.isDependency(x));
                    if (failedDependency.length > 0) {
                        tasksFailed.push(...failedDependency);
                        for (const dependency of failedDependency) {
                            dependency.failed = true;
                            dependency.done = true;
                        }
                        if (tasksFailed.length > delegate.failedTasksTolerance) {
                            throw new OrgFormationError(`Number of failed tasks ${tasksFailed.length} exceeded tolerance for failed tasks ${delegate.failedTasksTolerance}.`);
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
                    tasksFailed.push(...tasksWithDependencies);
                    const names = tasksWithDependencies.map(x => delegate.getName(x));
                    throw new OrgFormationError(`Circular dependency detected with tasks:\n - ${names.join('\n - ')}`);
                }
                await Promise.all(runningTaskPromises);
                const failedTasks = runningTasks.filter(x => x.failed === true);
                tasksFailed.push(...failedTasks);
                if (tasksFailed.length > delegate.failedTasksTolerance) {
                    throw new OrgFormationError(`Number of failed tasks ${tasksFailed.length} exceeded tolerance for failed tasks ${delegate.failedTasksTolerance}.`);
                }
                runningTasks = [];
                runningTaskPromises = [];
                remainingTasks = tasksWithDependencies;
                tasksWithDependencies = [];
            } while (remainingTasks.length > 0);

            if (tasksFailed.length > 0) {
                ConsoleUtil.LogWarning(`Done performing task(s). ${tasksFailed.length} failed but did not exceed tolerance for failed tasks ${delegate.failedTasksTolerance}`);
                ConsoleUtil.LogWarning('Following tasks failed: ');
                for (const failed of tasksFailed) {
                    ConsoleUtil.LogWarning(` - ${delegate.getName(failed)}`);
                }
            } else {
                ConsoleUtil.LogDebug('Done performing task(s).');
            }

        } catch (err) {
            ConsoleUtil.LogError('Stopped performing task(s)');
            const succeededTasks = tasks.filter(x=>x.done === true && x.failed === false);
            if (succeededTasks.length > 0) {
                ConsoleUtil.LogError('Following tasks completed: ');
                for (const succeeded of succeededTasks) {
                    ConsoleUtil.LogError(` - ${delegate.getName(succeeded)}`);
                }
            }
            const failedTasks = tasks.filter(x=>x.done === true && x.failed === true);
            if (failedTasks.length > 0) {
                ConsoleUtil.LogError('Following tasks failed: ');
                for (const succeeded of failedTasks) {
                    ConsoleUtil.LogError(` - ${delegate.getName(succeeded)}`);
                }
            }
            const remainedTasks = tasks.filter(x=>x.done !== true);
            if (remainedTasks.length > 0) {
                ConsoleUtil.LogError('Following tasks were not executed: ');
                for (const remained of remainedTasks) {
                    ConsoleUtil.LogError(` - ${delegate.getName(remained)}`);
                }
            }
            throw err;
        }
    }

    private static async performTask<TTask>(task: IGenericTaskInternal<TTask>, delegate: ITaskRunnerDelegates<TTask>): Promise<void> {
        let retryWhenRateLimited = false;
        let retryAttemptRateLimited = 0;

        if (task.skip) {
            ConsoleUtil.LogInfo(`${delegate.getName(task)} ${delegate.getVerb(task)} skipped.`);
            task.done = true;
            task.failed = false;
            return;
        }

        do {
            try {
                ConsoleUtil.LogDebug(`${delegate.getName(task)} ${delegate.getVerb(task)} starting...`);
                retryWhenRateLimited = false;
                task.running = true;
                task.promise = task.perform();
                await task.promise;
                task.done = true;
                task.failed = false;
                task.running = false;
                ConsoleUtil.LogInfo(`${delegate.getName(task)} ${delegate.getVerb(task)} successful.`);
            } catch (err) {
                if ((err.code === 'Throttling' || err.code === 'OptInRequired') && retryAttemptRateLimited < 5) {
                    retryWhenRateLimited = true;
                    retryAttemptRateLimited = retryAttemptRateLimited + 1;
                    await sleep(Math.pow(retryAttemptRateLimited, 2) + Math.random());
                    continue;
                }
                task.done = true;
                task.failed = true;
                task.running = false;
                ConsoleUtil.LogError(`${delegate.getName(task)} ${delegate.getVerb(task)} failed. reason: ${err.message}`, err instanceof OrgFormationError ? undefined : err);
            }
        } while (retryWhenRateLimited);
    }
}

export interface ITaskRunnerDelegates<TTask> {
    maxConcurrentTasks: number;
    failedTasksTolerance: number;
    getName(task: IGenericTaskInternal<TTask>): string;
    getVerb(task: IGenericTaskInternal<TTask>): string;
}

export type IGenericTaskInternal<TTask> = IGenericTask<TTask> & IGenericTaskState & TTask;

export interface IGenericTask<TTask> {
    isDependency(task: TTask): boolean;
    perform(): Promise<void>;
    skip?: boolean;
}

export interface IGenericTaskState {
    done?: boolean;
    failed?: boolean;
    running?: boolean;
    promise?: Promise<void>;
}

const sleep = async (seconds: number): Promise<void> => {
    return new Promise(resolve => {
        setTimeout(resolve, seconds * 1000);
    });
};
