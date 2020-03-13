import { CredentialsOptions } from "aws-sdk/lib/credentials";
import { exec, ExecException, ExecOptions } from "child_process";
import { AwsUtil } from "../aws-util";
import { ConsoleUtil } from "../console-util";
import AWS from "aws-sdk";


export class ChildProcessUtility {

    public static async SpawnProcessForAccount(cwd: string, command: string, accountId: string): Promise<void> {
        ConsoleUtil.LogInfo(`executing command: ${command} in account ${accountId}`);

        let credentials: CredentialsOptions = AWS.config.credentials;
        if (accountId !== await AwsUtil.GetMasterAccountId()) {
            credentials = await AwsUtil.getCredentials(accountId);
        }
        const options: ExecOptions = {
            cwd,
            env: process.env
        };

        if (credentials !== undefined) {
            options.env = {
                ...options.env,
                'AWS_ACCESS_KEY_ID': credentials.accessKeyId,
                'AWS_SECRET_ACCESS_KEY': credentials.secretAccessKey,
                'AWS_SESSION_TOKEN': credentials.sessionToken
            }
        }

        return this.SpawnProcess(command, options);
    };

    public static SpawnProcess(command: string, options: ExecOptions): Promise<void> {
        //options.shell = '/bin/bash';
        return new Promise((resolve, reject) => {
            const childProcess = exec(command, options, (err: ExecException) => {
                if (err) {
                    reject(err)
                    return;
                }
                resolve();
            });

            childProcess.stdout.on('data', (x) => {
                ConsoleUtil.LogDebug(x);
            });

            childProcess.stderr.on('data', (x) => {
                ConsoleUtil.LogDebug(x);
            });
        });
    };
}