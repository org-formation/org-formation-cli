import { ConsoleUtil } from '~util/console-util';
import { OrgFormationError } from '~org-formation-error';

export class GenericTaskRunner {

    public static RethrowTaskErrors = false;


    public static async RunTasks<TTask>(tasks: IGenericTaskInternal<TTask>[], delegate: ITaskRunnerDelegates<TTask>): Promise<void> {
        if (delegate.maxConcurrentTasks === 0) {
            throw new OrgFormationError('Cannot run tasks with 0 concurrent tasks.');
        }
        let remainingTasks: IGenericTaskInternal<TTask>[] = tasks;
        let tasksWithDependencies: IGenericTaskInternal<TTask>[] = [];
        let runningTasks: IGenericTaskInternal<TTask>[] = [];
        const tasksFailed: IGenericTaskInternal<TTask>[] = [];
        const tasksSkipped: IGenericTaskInternal<TTask>[] = [];
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


                    if (runningTasks.length >= delegate.maxConcurrentTasks) {
                        tasksWithDependencies.push(task);
                        continue;
                    }

                    const skippedDependency = tasksSkipped.filter(x => task.isDependency(x) && (x as any).type !== 'update-organization');
                    if (skippedDependency.length > 0) {
                        if (typeof task.skip !== 'boolean') {
                            const skippedDependencyNames = skippedDependency.map(() =>delegate.getName(task)).join(', ');
                            ConsoleUtil.LogInfo(`Overriding skipping configuration for task ${delegate.getName(task)} because of dependency with that was skipped. dependencies: ${skippedDependencyNames}.`);
                            task.skip = true;
                        }
                    } else {
                        const failedDependency = tasksFailed.filter(x => task.isDependency(x));
                        if (failedDependency.length > 0) {
                            tasksFailed.push(task);

                            task.failed = true;
                            task.done = true;
                            task.skipped = false;

                            if (tasksFailed.length > delegate.failedTasksTolerance) {
                                throw new OrgFormationError(`Number of failed tasks ${tasksFailed.length} exceeded tolerance for failed tasks ${delegate.failedTasksTolerance}.`);
                            }
                            continue;
                        }
                    }

                    const taskPromise = GenericTaskRunner.performTask(task, delegate);
                    runningTaskPromises.push(taskPromise);
                    runningTasks.push(task);
                }

                if (runningTasks.length === 0 && tasksWithDependencies.length > 0) {
                    const circularDependencyTasks = [];
                    for(const task of tasksWithDependencies)
                    {
                        if (tasksFailed.filter(x=>task.isDependency(x)).length === 0) {
                            circularDependencyTasks.push(task);
                        } else {
                            tasksFailed.push(task);
                        }
                    }
                    if (circularDependencyTasks.length > 1) {
                        tasksFailed.push(...circularDependencyTasks);
                        const names = tasksWithDependencies.map(x => delegate.getName(x));
                        throw new OrgFormationError(`Circular dependency detected with tasks:\n - ${names.join('\n - ')}`);
                    }
                    tasksWithDependencies = [];
                }
                await Promise.all(runningTaskPromises);
                const failedTasks = runningTasks.filter(x => x.failed === true);
                tasksFailed.push(...failedTasks);
                if (tasksFailed.length > delegate.failedTasksTolerance) {
                    throw new OrgFormationError(`Number of failed tasks ${tasksFailed.length} exceeded tolerance for failed tasks ${delegate.failedTasksTolerance}.`);
                }
                const skippedTasks = runningTasks.filter(x=>x.skipped === true);
                tasksSkipped.push(...skippedTasks);
                runningTasks = [];
                runningTaskPromises = [];
                remainingTasks = tasksWithDependencies;
                tasksWithDependencies = [];
            } while (remainingTasks.length > 0);

            if (tasksFailed.length > 0) {
                ConsoleUtil.LogWarning('');
                ConsoleUtil.LogWarning('========================');
                ConsoleUtil.LogWarning(`Done performing task(s): ${tasksFailed.length} failed but did not exceed tolerance for failed tasks ${delegate.failedTasksTolerance}`);
                ConsoleUtil.LogWarning('Following tasks failed: ');
                for (const failed of tasksFailed) {
                    ConsoleUtil.LogWarning(` - ${delegate.getName(failed)}`);
                }
                ConsoleUtil.LogWarning('========================');
                ConsoleUtil.LogWarning('');
            } else {
                ConsoleUtil.LogDebug('Done performing task(s).', delegate.logVerbose);
            }

        } catch (err) {
            ConsoleUtil.LogError('');
            ConsoleUtil.LogError('==========================');
            ConsoleUtil.LogError('Stopped performing task(s)');
            const succeededTasks = tasks.filter(x=>x.done === true && x.failed === false && x.skipped !== true);
            if (succeededTasks.length > 0) {
                ConsoleUtil.LogError('Following tasks completed: ');
                for (const succeeded of succeededTasks) {
                    ConsoleUtil.LogError(` - ${delegate.getName(succeeded)}`);
                }
            }
            const skippedTasks = tasks.filter(x=>x.done === true && x.failed === false && x.skipped === true);
            if (skippedTasks.length > 0) {
                ConsoleUtil.LogError('Following tasks were configured to be skipped: ');
                for (const skipped of skippedTasks) {
                    ConsoleUtil.LogError(` - ${delegate.getName(skipped)}`);
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
            ConsoleUtil.LogError('==========================');
            ConsoleUtil.LogError('');
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
            task.skipped = true;
            return;
        }

        task.skipped = false;
        do {
            try {
                ConsoleUtil.LogDebug(`${delegate.getName(task)} ${delegate.getVerb(task)} starting...`, delegate.logVerbose);
                retryWhenRateLimited = false;
                task.running = true;
                task.promise = task.perform();
                await task.promise;
                task.done = true;
                task.failed = false;
                task.running = false;
                ConsoleUtil.LogInfo(`${delegate.getName(task)} ${delegate.getVerb(task)} successful.`);
            } catch (err) {
                if ((err.name === 'Throttling' || err.name === 'OptInRequired') && retryAttemptRateLimited < 5) {
                    retryWhenRateLimited = true;
                    retryAttemptRateLimited = retryAttemptRateLimited + 1;
                    await sleep(Math.pow(retryAttemptRateLimited, 2) + Math.random());
                    continue;
                }

                if (GenericTaskRunner.RethrowTaskErrors) {
                    throw err;
                }
                task.done = true;
                task.running = false;
                if (delegate.getVerb(task) === 'deleted') {
                    task.failed = false;
                    ConsoleUtil.LogWarning(`${delegate.getName(task)} ${delegate.getVerb(task)} failed. removing from state`);
                } else {
                    task.failed = true;
                    ConsoleUtil.LogError(`${delegate.getName(task)} ${delegate.getVerb(task)} failed. reason: ${err.message}`, err instanceof OrgFormationError ? undefined : err);
                }
            }
        } while (retryWhenRateLimited);
    }
}

export interface ITaskRunnerDelegates<TTask> {
    logVerbose: boolean;
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
    skipped?: boolean;
    running?: boolean;
    promise?: Promise<void>;
}

const sleep = async (seconds: number): Promise<void> => {
    return new Promise(resolve => {
        setTimeout(resolve, seconds * 1000);
    });
};
