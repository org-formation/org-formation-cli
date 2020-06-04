import { exec, ExecException, ExecOptions } from 'child_process';
import { CredentialsOptions } from 'aws-sdk/lib/credentials';
import AWS from 'aws-sdk';
import { AwsUtil, DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS } from './aws-util';
import { ConsoleUtil } from './console-util';


export class ChildProcessUtility {

    public static async SpawnProcessForAccount(cwd: string, command: string, accountId: string, roleInTargetAccount: string = DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS.RoleName, env: Record<string, string> = {}, logVerbose: boolean | undefined = undefined): Promise<void> {
        ConsoleUtil.LogInfo(`Executing command: ${command} in account ${accountId}`);

        let credentials: CredentialsOptions = AWS.config.credentials;
        if (accountId !== await AwsUtil.GetMasterAccountId()) {
            credentials = await AwsUtil.GetCredentials(accountId,  roleInTargetAccount);
        } else if (roleInTargetAccount !== DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS.RoleName) {
            credentials = await AwsUtil.GetCredentials(accountId,  roleInTargetAccount);
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
            };
        }

        if (credentials.sessionToken) {
            options.env.AWS_SESSION_TOKEN = credentials.sessionToken;
        }

        return await this.SpawnProcess(command, options, logVerbose);
    };

    public static SpawnProcess(command: string, options: ExecOptions, logVerbose: boolean | undefined = undefined): Promise<void> {
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
                if (typeof x === 'string') {
                    const trimmed = x.trim();
                    if (trimmed.length === 0) {return;}

                    const emptyIfOnlyDots = trimmed.replace(/\./g, '');
                    if (emptyIfOnlyDots.length === 0) {return;}

                    ConsoleUtil.LogDebug(trimmed, logVerbose);
                }
            });

            childProcess.stderr.on('data', x => {
                if (typeof x === 'string') {
                    const trimmed = x.trim();
                    if (trimmed.length === 0) {return;}

                    ConsoleUtil.LogDebug(trimmed, logVerbose);
                }
            });
        });
    };
}
