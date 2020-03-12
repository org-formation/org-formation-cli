import { CredentialsOptions } from "aws-sdk/lib/credentials";
import { exec, ExecException, ExecOptions } from "child_process";
import { AwsUtil } from "../aws-util";
import { ConsoleUtil } from "../console-util";


export class ChildProcessUtility {

    public static async SpawnProcessForAccount(cwd: string, command: string, accountId: string): Promise<void> {
        ConsoleUtil.LogDebug(`executing command: ${command} in account ${accountId}`);

        const credentials = await AwsUtil.getCredentials(accountId);
        const options = {
            cwd,
            env: {
                'AWS_ACCESS_KEY_ID': credentials.accessKeyId,
                'AWS_SECRET_ACCESS_KEY': credentials.secretAccessKey,
                'AWS_SESSION_TOKEN': credentials.sessionToken,
            }
        };

        return this.SpawnProcess(command, options);
    };

    public static SpawnProcess(command: string, options: ExecOptions): Promise<void> {
        return new Promise((resolve, reject) => {
            exec(command, options, (err: ExecException, stdout: string, stderr: string) => {
                if (err) {
                    reject(err)
                    return;
                }
                if (stderr) {
                    ConsoleUtil.LogError(stderr);
                }
                ConsoleUtil.LogDebug(stdout);
                resolve();
            });
        });
    };
}