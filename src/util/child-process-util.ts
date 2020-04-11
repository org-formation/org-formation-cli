import { exec, ExecException, ExecOptions } from 'child_process';
import { CredentialsOptions } from 'aws-sdk/lib/credentials';
import AWS from 'aws-sdk';
import { AwsUtil, DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS } from './aws-util';
import { ConsoleUtil } from './console-util';


export class ChildProcessUtility {

    public static async SpawnProcessForAccount(cwd: string, command: string, accountId: string, roleInTargetAccount: string = DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS, env: Record<string, string> = {} ): Promise<void> {
        ConsoleUtil.LogInfo(`executing command: ${command} in account ${accountId}`);

        let credentials: CredentialsOptions = AWS.config.credentials;
        if (accountId !== await AwsUtil.GetMasterAccountId()) {
            credentials = await AwsUtil.getCredentials(accountId,  roleInTargetAccount);
        } else if (roleInTargetAccount !== DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS) {
            credentials = await AwsUtil.getCredentials(accountId,  roleInTargetAccount);
        }
        const options: ExecOptions = {
            cwd,
            env: {...process.env, ...env},
        };

        if (credentials) {
            options.env = {
                ...options.env,
                AWS_ACCESS_KEY_ID: credentials.accessKeyId,
                AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
                AWS_SESSION_TOKEN: credentials.sessionToken,
            };
        }

        return await this.SpawnProcess(command, options);
    };

    public static SpawnProcess(command: string, options: ExecOptions): Promise<void> {
        // options.shell = '/bin/bash';
        return new Promise((resolve, reject) => {
            const childProcess = exec(command, options, (err: ExecException) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });

            childProcess.stdout.on('data', x => {
                ConsoleUtil.LogDebug(x);
            });

            childProcess.stderr.on('data', x => {
                ConsoleUtil.LogDebug(x);
            });
        });
    };
}
