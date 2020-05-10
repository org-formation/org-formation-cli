
import * as readline from 'readline';
import { PersistedState } from '~state/persisted-state';

export class ConsoleUtil {

    public static printStacktraces = false;
    public static verbose = false;
    public static colorizeLogs = true;
    public static state: PersistedState = undefined;

    public static LogDebug(message: string): void {
        if (!ConsoleUtil.verbose) { return; }
        console.debug(`DEBG: ${matchAndAppendLogicalAccountNames(message)}`);
    }

    public static Out(message: string): void {
        console.log(message);
    }

    public static LogInfo(message: string): void {
        console.log(`INFO: ${matchAndAppendLogicalAccountNames(message)}`);
    }

    public static LogWarning(message: string): void {
        const formatted = `WARN: ${matchAndAppendLogicalAccountNames(message)}`;
        console.warn(yellow(formatted));
    }

    public static LogError(message: string, err?: Error): void {
        const formatted = `ERROR: ${matchAndAppendLogicalAccountNames(message)}`;
        console.error(red(formatted));

        if (err !== undefined) {
            if (ConsoleUtil.printStacktraces) {
                console.error(red(`${err.message}\n${err.stack}`));
            } else {
                console.error(red(`${err.message} (use option --print-stack to print stack)`));
            }
        }
    }

    public static async Readline(message: string): Promise<string> {

        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

        const getLine = (): Promise<string> => {
            return new Promise<string>(resolve => {
                rl.on('line', input => {
                    resolve(input);
                    rl.close();
                });
            });
        };

        console.log(message + ':');
        return await getLine();
    }
}

const red = (message: string): string => {
    return ConsoleUtil.colorizeLogs ? `\x1b[31m${message}\x1b[0m` : message;
};

const yellow = (message: string): string => {
    return ConsoleUtil.colorizeLogs ? `\x1b[33m${message}\x1b[0m` : message;
};


const matchAndAppendLogicalAccountNames = (message: string): string => {
    if (ConsoleUtil.state === undefined) {
        return message;
    }

    let mappings = '';
    const accountIdRegex = new RegExp('[0-9]{12}', 'g');
    const matches = accountIdRegex.exec(message);
    if (!Array.isArray(matches)) {return message;}
    for(const match of matches) {
        const logicalId = ConsoleUtil.state.getLogicalIdForPhysicalId(match);
        if (logicalId === undefined)
         {
             continue;
         }
        if (mappings !== '') {
            mappings += ', ';
        }
        mappings += `${match} = ${logicalId}`;
    }
    if (mappings !== '') {
        const messageWithMapping = message + ' (' + mappings + ')';
        return messageWithMapping;
    }
    return message;
};
