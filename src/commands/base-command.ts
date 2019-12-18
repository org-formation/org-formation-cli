import AWS, { Organizations, STS } from 'aws-sdk';
import { AssumeRoleRequest } from 'aws-sdk/clients/sts';
import { SharedIniFileCredentialsOptions } from 'aws-sdk/lib/credentials/shared_ini_file_credentials';
import { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import * as ini from 'ini';
import { AwsOrganization } from '../aws-provider/aws-organization';
import { AwsOrganizationReader } from '../aws-provider/aws-organization-reader';
import { AwsOrganizationWriter } from '../aws-provider/aws-organization-writer';
import { ConsoleUtil } from '../console-util';
import { OrganizationBinder } from '../org-binder/org-binder';
import { TaskProvider } from '../org-binder/org-tasks-provider';
import { OrgFormationError } from '../org-formation-error';
import { TemplateRoot } from '../parser/parser';
import { PersistedState } from '../state/persisted-state';
import { IStorageProvider, S3StorageProvider } from '../state/storage-provider';
import { DefaultTemplate, DefaultTemplateWriter } from '../writer/default-template-writer';

export abstract class BaseCliCommand<T extends ICommandArgs> {

    protected command: Command;
    protected firstArg: any;

    private masterAccountId?: string;

    constructor(command?: Command, name?: string, description?: string, firstArgName?: string) {
        if (command !== undefined && name !== undefined) {
        this.command = command.command(name);
        if (description !== undefined) {
            this.command.description(description);
        }
        this.command.allowUnknownOption(false);
        this.addOptions(this.command);
        this.command.action(async (firstArg: string) => {
            if (firstArgName && (typeof firstArg !== 'object')) {
                this.command[firstArgName] = firstArg;
            }
            this.handleErrors();
        }); }
    }
    protected abstract async performCommand(command: T): Promise<void>;

    protected addOptions(command: Command) {
        command.option('--state-bucket-name [state-bucket-name]', 'bucket name that contains state file', 'organization-formation-${AWS::AccountId}');
        command.option('--state-object [state-object]', 'key for object used to store state', 'state.json');
        command.option('--profile [profile]', 'aws profile to use');
    }

    protected async getOrganizationBinder(template: TemplateRoot, state: PersistedState) {
        const organizations = new Organizations({ region: 'us-east-1' });
        const awsReader = new AwsOrganizationReader(organizations);
        const awsOrganization = new AwsOrganization(awsReader);
        await awsOrganization.initialize();
        const awsWriter = new AwsOrganizationWriter(organizations, awsOrganization);
        const taskProvider = new TaskProvider(template, state, awsWriter);
        const binder = new OrganizationBinder(template, state, taskProvider);
        return binder;
    }

    protected async generateDefaultTemplate(): Promise<DefaultTemplate> {

        const organizations = new Organizations({ region: 'us-east-1' });
        const awsReader = new AwsOrganizationReader(organizations);
        const awsOrganization = new AwsOrganization(awsReader);
        const writer = new DefaultTemplateWriter(awsOrganization);
        const template = await writer.generateDefaultTemplate();
        template.template = template.template.replace(/( *)-\n\1 {2}/g, '$1- ');
        const parsedTemplate = TemplateRoot.createFromContents(template.template, './');
        template.state.setPreviousTemplate(parsedTemplate.source);
        return template;
    }

    protected async createStateBucket(command: ICommandArgs, region: string): Promise<S3StorageProvider> {
        const objectKey = command.stateObject;
        const stateBucketName = await this.GetStateBucketName(command);
        const storageProvider = await S3StorageProvider.Create(stateBucketName, objectKey);
        await storageProvider.create(region);
        return storageProvider;
    }

    protected async getStateBucket(command: ICommandArgs): Promise<S3StorageProvider> {
        const objectKey = command.stateObject;
        const stateBucketName = await this.GetStateBucketName(command);
        const storageProvider = await S3StorageProvider.Create(stateBucketName, objectKey);
        return storageProvider;
    }

    protected async getState(command: ICommandArgs): Promise<PersistedState> {
        const storageProvider = await this.getStateBucket(command);
        const accountId = await this.getMasterAccountId();

        try {
            const state = await PersistedState.Load(storageProvider, accountId);
            return state;
        } catch (err) {
            if (err && err.code === 'NoSuchBucket') {
                throw new OrgFormationError(`unable to load previously committed state, reason: bucket '${storageProvider.bucketName}' does not exist in current account.`);
            }
            throw err;
        }
    }

    protected async GetStateBucketName(command: ICommandArgs): Promise<string> {
        const bucketName = command.stateBucketName || 'organization-formation-${AWS::AccountId}';
        if (bucketName.indexOf('${AWS::AccountId}') >= 0) {
            const accountId = await this.getMasterAccountId();
            return bucketName.replace('${AWS::AccountId}', accountId);
        }
        return bucketName;
    }

    protected parseStackParameters(commandParameters?: string | {}) {
        if (commandParameters && typeof commandParameters === 'object') {
            return commandParameters;
        }
        const parameters: Record<string, string> = {};
        if (commandParameters && typeof commandParameters === 'string') {
            const parameterParts = commandParameters.split(' ');
            for (const parameterPart of parameterParts) {
                const parameterAttributes = parameterPart.split(',');
                if (parameterAttributes.length === 1) {
                    const parts = parameterAttributes[0].split('=');
                    if (parts.length !== 2) {
                        throw new OrgFormationError(`error reading parameter ${parameterAttributes[0]}. Expected either key=val or ParameterKey=key,ParameterVaue=val.`);
                    }
                    parameters[parts[0]] = parts[1];
                } else {
                    const key = parameterAttributes.find((x) => x.startsWith('ParameterKey='));
                    const value = parameterAttributes.find((x) => x.startsWith('ParameterValue='));
                    if (key === undefined || value === undefined) {
                        throw new OrgFormationError(`error reading parameter ${parameterAttributes[0]}. Expected ParameterKey=key,ParameterVaue=val`);
                    }
                    parameters[key] = value;
                }
            }
        }

        return parameters;
    }
    private async getMasterAccountId(): Promise<string> {
        if (this.masterAccountId !== undefined) {
            return this.masterAccountId;
        }
        const stsClient = new STS();
        const caller = await stsClient.getCallerIdentity().promise();
        this.masterAccountId = caller.Account;
        return this.masterAccountId;
    }

    private async customInitializationIncludingMFASupport(command: ICommandArgs)  {
        const profileName = command.profile ? command.profile : 'default';
        const homeDir = require('os').homedir();
        // todo: add support for windows?
        if (!existsSync(homeDir + '/.aws/config')) {
            return;
        }
        const awsconfig = readFileSync(homeDir + '/.aws/config').toString('utf8');
        const contents = ini.parse(awsconfig);
        const profile = contents['profile ' + profileName];
        if (profile && profile.source_profile) {
            const awssecrets = readFileSync(homeDir + '/.aws/credentials').toString('utf8');
            const secrets = ini.parse(awssecrets);
            const creds = secrets[profile.source_profile];
            const sts = new STS({ credentials: { accessKeyId: creds.aws_access_key_id, secretAccessKey: creds.aws_secret_access_key } });

            const token = await ConsoleUtil.Readline(`👋 Enter MFA code for ${profile.mfa_serial}`);
            const assumeRoleReq: AssumeRoleRequest = {
                RoleArn: profile.role_arn,
                RoleSessionName: 'organization-build',
                SerialNumber: profile.mfa_serial,
                TokenCode: token,
            };

            try {
                const tokens = await sts.assumeRole(assumeRoleReq).promise();
                AWS.config.credentials = { accessKeyId: tokens.Credentials.AccessKeyId, secretAccessKey: tokens.Credentials.SecretAccessKey, sessionToken: tokens.Credentials.SessionToken };
            } catch (err) {
                throw new OrgFormationError(`unable to assume role, error: \n${err}`);
            }
        }
    }

    private async initialize(command: ICommandArgs) {
        try {
            await this.customInitializationIncludingMFASupport(command);
        } catch (err) {
            if (err instanceof OrgFormationError) {
                throw err;
            }
            ConsoleUtil.LogInfo(`custom initialization failed, not support for MFA token\n${err}`);
        }

        const options: SharedIniFileCredentialsOptions = {};
        if (command.profile) {
            options.profile = command.profile;
        }

        const credentials = new AWS.SharedIniFileCredentials(options);
        if (credentials.accessKeyId) {
            AWS.config.credentials = credentials;
        }
    }

    private async handleErrors() {
        try {
            await this.initialize(this.command as any as ICommandArgs);
            await this.performCommand(this.command as any as T);
        } catch (err) {
            if (err instanceof OrgFormationError) {
                ConsoleUtil.LogError(err.message);
            } else {
                if (err.code && err.requestId) {
                    ConsoleUtil.LogError(`error: ${err.code}, aws-request-id: ${err.requestId}`);
                    ConsoleUtil.LogError(err.message);

                } else {
                    ConsoleUtil.LogError(`unexpected error occurred...`, err);
                }
            }
            process.exitCode = 1;
        }
    }
}

export interface ICommandArgs {
    stateBucketName: string;
    stateObject: string;
    profile?: string;
}
