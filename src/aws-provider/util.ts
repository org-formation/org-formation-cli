import { ConsoleUtil } from '~util/console-util';

export const performAndRetryIfNeeded = async <T extends unknown>(fn: () => Promise<T>): Promise<T> => {
  let shouldRetry = false;
  let retryCount = 0;
  do {
    shouldRetry = false;
    try {
      return await fn();
    } catch (err) {
      if (err && (err.code === 'ConcurrentModificationException' || err.code === 'TooManyRequestsException') && retryCount < 30) {
        retryCount = retryCount + 1;
        shouldRetry = true;
        const wait = retryCount + (0.5 * Math.random());
        ConsoleUtil.LogDebug(`received retryable error ${err.code}. wait ${wait} and retry-count ${retryCount}`);
        await sleep(wait * 1000);
        continue;
      }
      throw err;
    }
  }
  while (shouldRetry);
};

export const sleep = (time: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, time));
};
