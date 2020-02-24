
import * as readline from 'readline';

export class ConsoleUtil {
    public static printStacktraces = false;
    public static verbose = false;
    public static colorizeLogs = true;

    public static LogDebug(message: string) {
        if (!ConsoleUtil.verbose) { return; }
        console.debug(`DEBG: ${message}`);
    }

    public static Out(message: string) {
        console.log(message);
    }

    public static LogInfo(message: string) {
        console.log(`INFO: ${message}`);
    }

    public static LogWarning(message: string) {
        const formatted = `WARN: ${message}`;
        console.warn(yellow(formatted));
    }

    public static LogError(message: string, err?: Error) {
        const formatted = `ERROR: ${message}`;
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

        const getLine = () => {
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

const red = (message: string) => {
    return ConsoleUtil.colorizeLogs ? `\x1b[31m${message}\x1b[0m` : message;
};

const yellow = (message: string) => {
    return ConsoleUtil.colorizeLogs ? `\x1b[33m${message}\x1b[0m` : message;
};

