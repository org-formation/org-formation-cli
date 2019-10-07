
import * as readline from 'readline';

export class ConsoleUtil {
    public static verbose = false;

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
        console.warn(`WARN: ${message}`);
    }

    public static LogError(message: string, err?: Error ) {
        console.error(`ERROR: ${message}`);
        if (err) {
            console.error(err);
        }
    }

    public static async Readline(message: string): Promise<string> {

        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

        const getLine = () => {
            return new Promise<string>((resolve) => {
                rl.on('line', (input) => {
                    resolve(input);
                    rl.close();
                });
            });
        };

        console.log(message + ':');
        return await getLine();
    }
}
