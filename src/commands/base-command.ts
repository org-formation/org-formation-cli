import path from 'path';
import { existsSync, readFileSync } from 'fs';
import { Command } from 'commander';
import minimatch from 'minimatch';
import RC from 'rc';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import { AwsUtil } from '../util/aws-util';
import { ConsoleUtil } from '../util/console-util';
import { OrgFormationError } from '../org-formation-error';
import { IPerformTasksCommandArgs } from './perform-tasks';
import { IPrintTasksCommandArgs } from './print-tasks';
import { AwsOrganization } from '~aws-provider/aws-organization';
import { AwsOrganizationReader } from '~aws-provider/aws-organization-reader';
import { AwsOrganizationWriter } from '~aws-provider/aws-organization-writer';
import { OrganizationBinder } from '~org-binder/org-binder';
import { TaskProvider } from '~org-binder/org-tasks-provider';
import { TemplateRoot } from '~parser/parser';
import { PersistedState } from '~state/persisted-state';
import { S3StorageProvider } from '~state/storage-provider';
import { DefaultTemplate, DefaultTemplateWriter, ITemplateGenerationSettings } from '~writer/default-template-writer';
import { CfnParameters } from '~core/cfn-parameters';
import { Validator } from '~parser/validator';
import { CfnExpressionResolver } from '~core/cfn-expression-resolver';
import { NunjucksDebugSettings } from '~yaml-cfn/index';
import { IBuildTask } from '~build-tasks/build-configuration';
import { ClientCredentialsConfig } from '~util/aws-types';

const DEFAULT_STATE_OBJECT = 'state.json';

export abstract class BaseCliCommand<T extends ICommandArgs> {

    protected command: Command;
    protected firstArg: any;

    static CliCommandArgs: ICommandArgs;
    static StateBucketName: string;

    static async CreateAdditionalArgsForInvocation(): Promise<string> {
        let additionalArgs = '';
        const cliArgs = BaseCliCommand.CliCommandArgs;
        if (cliArgs) {
            const profile = cliArgs.profile;
            const stateBucketName = cliArgs.stateBucketName;
            const stateObject = cliArgs.stateObject;

            if (profile !== undefined) {
                additionalArgs += `--profile ${profile} `;
            }

            const defaultStateBucketName = await BaseCliCommand.GetStateBucketName(undefined);

            if (stateBucketName !== undefined && stateBucketName !== defaultStateBucketName) {
                additionalArgs += `--state-bucket-name ${stateBucketName} `;
            }

            if (stateObject !== undefined && stateObject !== DEFAULT_STATE_OBJECT) {
                additionalArgs += `--state-object ${stateObject} `;
            }
        }
        return additionalArgs;
    }

    constructor(command?: Command, name?: string, description?: string, firstArgName?: string, private rc?: Record<string, any>) {
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
                this.invoke();
            });
        }
    }

    public loadTemplatingContext(command: { templatingContextFile?: string; TemplatingContext?: {} }): void {
        if (typeof command.templatingContextFile === 'string') {
            if (!existsSync(command.templatingContextFile)) {
                throw new OrgFormationError('unable to find templating context file with path: ' + command.templatingContextFile);
            }

            command.TemplatingContext = JSON.parse(readFileSync(command.templatingContextFile).toString());
        }
    }

    public storeCommand(command: ICommandArgs): void {
        if (BaseCliCommand.CliCommandArgs === undefined) {
            BaseCliCommand.CliCommandArgs = command;
        }
    }

    public async generateDefaultTemplate(defaultBuildAccessRoleName?: string, templateGenerationSettings?: ITemplateGenerationSettings): Promise<DefaultTemplate> {
        return DefaultTemplateWriter.CreateDefaultTemplateFromAws(defaultBuildAccessRoleName, templateGenerationSettings);
    }

    public async getState(command: ICommandArgs): Promise<PersistedState> {
        if (command.state) {
            return command.state;
        }

        const storageProvider = await this.getStateStorageProvider(command);

        BaseCliCommand.StateBucketName = storageProvider.bucketName;
        const accountId = await AwsUtil.GetMasterAccountId();

        try {
            const state = await PersistedState.Load(storageProvider, accountId);
            if (command.organizationState !== undefined) {
                state.setReadonlyOrganizationState(command.organizationState);
            } else if (command.organizationStateObject !== undefined) {
                const orgStorageProvider = await this.getOrganizationStateStorageProvider(command);
                const orgState = await PersistedState.Load(orgStorageProvider, accountId);
                state.setReadonlyOrganizationState(orgState);
            }
            command.state = state;
            return state;
        } catch (err) {
            if (err && err.name === 'NoSuchBucket') {
                throw new OrgFormationError(`unable to load previously committed state, reason: bucket '${storageProvider.bucketName}' does not exist in current account.`);
            }
            throw err;
        }
    }

    public async invoke(): Promise<void> {
        try {
            await this.initialize(this.command as any as ICommandArgs);
            await this.performCommand(this.command as any as T);
        } catch (err) {
            if (err instanceof OrgFormationError) {
                ConsoleUtil.LogError(err.message);
            } else {
                if (err.name && err.requestId) {
                    ConsoleUtil.LogError(`error: ${err.name}, aws-request-id: ${err.requestId}`);
                    ConsoleUtil.LogError(err.message);

                } else {
                    ConsoleUtil.LogError('unexpected error occurred...', err);
                }
            }
            process.exitCode = 1;
        }
    }
    protected abstract performCommand(command: T): Promise<void>;

    protected addOptions(command: Command): void {
        command.option('--state-bucket-name [state-bucket-name]', 'bucket name that contains state file', 'organization-formation-${AWS::AccountId}');
        command.option('--state-object [state-object]', 'key for object used to store state', DEFAULT_STATE_OBJECT);
        command.option('--profile [profile]', 'aws profile to use');
        command.option('--print-stack', 'will print stack traces for errors');
        command.option('--verbose', 'will enable debug logging');
        command.option('--no-color', 'will disable colorization of console logs');
        command.option('--master-account-id [master-account-id]', 'run org-formation on a build account that functions as a delegated master account');
        command.option('--is-partition', 'is run on a partition');
        command.option('--partition-keys', 'is to indicate to look for partition access keys');
        command.option('--partition-profile [profile]', 'aws partition profile to use');
        command.option('--partition-region [region]', 'aws partition region to use');
        command.option('--exclude-accounts <exclude-accounts>', 'comma delimited list of accountIds that need to be excluded');

    }

    protected async getOrganizationBinder(template: TemplateRoot, state: PersistedState): Promise<OrganizationBinder> {
        let roleInMasterAccount: string;
        if (template.organizationSection.masterAccount) {
            roleInMasterAccount = template.organizationSection.masterAccount.buildAccessRoleName;
        }
        const masterAccountId = await AwsUtil.GetMasterAccountId();
        const organizations = AwsUtil.GetOrganizationsService(masterAccountId, roleInMasterAccount);
        const partitionCredentials = await AwsUtil.GetPartitionCredentials();
        const crossAccountConfig = { masterAccountId, masterAccountRoleName: roleInMasterAccount };

        // configure default Organization/Reader/Writer
        const awsReader: AwsOrganizationReader = new AwsOrganizationReader(organizations, crossAccountConfig);
        const awsOrganization = new AwsOrganization(awsReader);
        await awsOrganization.initialize();
        const awsWriter = new AwsOrganizationWriter(organizations, awsOrganization, crossAccountConfig);

        // configure partition Organization/Reader/Writer
        let partitionReader: AwsOrganizationReader;
        let partitionOrganization: AwsOrganization;
        let partitionWriter: AwsOrganizationWriter;
        if (partitionCredentials) {
            const partitionMasterAccountId = await AwsUtil.GetPartitionMasterAccountId();
            const partitionCrossAccountConfig = { masterAccountId: partitionMasterAccountId, masterAccountRoleName: roleInMasterAccount };
            const partitionOrgService = AwsUtil.GetOrganizationsService(partitionMasterAccountId, roleInMasterAccount, null, true);
            partitionReader = new AwsOrganizationReader(partitionOrgService, partitionCrossAccountConfig);
            partitionOrganization = new AwsOrganization(partitionReader);
            await partitionOrganization.initialize();
            partitionWriter = new AwsOrganizationWriter(partitionOrgService, partitionOrganization, partitionCrossAccountConfig);
        }

        const taskProvider = new TaskProvider(template, state, awsWriter, partitionWriter);
        const binder = new OrganizationBinder(template, state, taskProvider);
        return binder;
    }

    protected async createOrGetStateBucket(command: ICommandArgs, region: string, accountId?: string, credentials?: ClientCredentialsConfig): Promise<S3StorageProvider> {
        const storageProvider = await this.getStateStorageProvider(command, accountId, credentials, region);
        try {
            await storageProvider.create(region);
        } catch (err) {
            if (err && err.name === 'BucketAlreadyOwnedByYou') {
                return storageProvider;
            }
            throw err;
        }
        return storageProvider;
    }

    protected async getStateStorageProvider(command: ICommandArgs, accountId?: string, credentials?: ClientCredentialsConfig, region?: string): Promise<S3StorageProvider> {
        const objectKey = command.stateObject;
        const stateBucketName = await BaseCliCommand.GetStateBucketName(command.stateBucketName, accountId);
        let storageProvider;
        if (command.isPartition) {
            storageProvider = S3StorageProvider.Create(stateBucketName, objectKey, credentials, AwsUtil.GetPartitionRegion());
        } else {
            storageProvider = S3StorageProvider.Create(stateBucketName, objectKey, credentials, region);
        }
        if (BaseCliCommand.CliCommandArgs && (BaseCliCommand.CliCommandArgs as IPerformTasksCommandArgs).skipStoringState) {
            storageProvider.dontPut = true;
        }
        return storageProvider;
    }

    protected async getOrganizationStateStorageProvider(command: ICommandArgs): Promise<S3StorageProvider> {
        const objectKey = command.organizationStateObject;
        const stateBucketName = await BaseCliCommand.GetStateBucketName(command.organizationStateBucketName || command.stateBucketName);
        const storageProvider = S3StorageProvider.Create(stateBucketName, objectKey);
        return storageProvider;
    }

    protected async getOrganizationFileStorageProvider(command: IPerformTasksCommandArgs): Promise<S3StorageProvider> {
        const objectKey = command.organizationObject;
        const stateBucketName = await BaseCliCommand.GetStateBucketName(command.stateBucketName);
        const storageProvider = S3StorageProvider.Create(stateBucketName, objectKey);
        return storageProvider;
    }

    protected static async GetStateBucketName(stateBucketName: string, accountId?: string): Promise<string> {
        const bucketName = stateBucketName || 'organization-formation-${AWS::AccountId}';
        if (bucketName.indexOf('${AWS::AccountId}') >= 0) {
            if (accountId === undefined) {
                accountId = await AwsUtil.GetBuildProcessAccountId();
            }
            return bucketName.replace('${AWS::AccountId}', accountId);
        }
        return bucketName;
    }

    protected parseCfnParameters(commandParameters?: string | undefined | {}): Record<string, string> {

        if (typeof commandParameters === 'object') {
            return commandParameters as Record<string, string>;
        }
        if (typeof commandParameters === 'string') {
            return CfnParameters.ParseParameterValues(commandParameters);
        }

        return {};
    }

    protected skipNonMatchingLeafTasks(tasks: IBuildTask[], taskMatcher: string, tasksPrefix: string): number {
        let skippedTasks = 0;
        for (const task of tasks) {
            const isLeafTask = task.childTasks.length === 0;
            const taskFullName = `${tasksPrefix}${task.name}`;

            if (isLeafTask) {
                const isMatching = task.name === taskMatcher || minimatch(taskFullName, taskMatcher);
                task.skip = isMatching ? false : true;
            } else {
                const skippedChildTasks = this.skipNonMatchingLeafTasks(task.childTasks, taskMatcher, `${taskFullName}/`);
                const isAllSkipped = task.childTasks.length === skippedChildTasks;
                task.skip = isAllSkipped ? true : false;
            }

            if (task.skip) {
                skippedTasks = skippedTasks + 1;
            }

            if (isLeafTask && task.skip !== true) {
                ConsoleUtil.LogInfo(`${taskFullName} matched the '${taskMatcher}' globPattern`);
            } else {
                ConsoleUtil.LogDebug(`${taskFullName} did not match the '${taskMatcher}' globPattern`);
            }

        }
        return skippedTasks;
    }

    protected async initialize(command: ICommandArgs): Promise<void> {
        if (command.initialized) { return; }

        // create a copy of `command` to ensure no circular references
        ConsoleUtil.LogDebug(`initializing, arguments: \n${JSON.stringify({
            stateBucketName: command.stateBucketName,
            stateObject: command.stateObject,
            profile: command.profile,
            color: command.color,
            verbose: command.verbose,
            printStack: command.printStack,
        }, undefined, 2)}`);

        this.loadRuntimeConfiguration(command);

        if (command.excludeAccounts) {
            const exclude = !command.excludeAccounts ? [] : command.excludeAccounts.split(',').map(x => x.trim());
            ConsoleUtil.LogInfo(`excluding the following accounts: ${exclude.join(', ')}`);
            AwsOrganizationReader.excludeAccountIds = exclude;
        }

        if (command.printStack === true) {
            ConsoleUtil.printStacktraces = true;
            Error.stackTraceLimit = 50;
        }
        if (command.verbose === true) {
            ConsoleUtil.verbose = true;
        }
        if (command.color === false) {
            ConsoleUtil.colorizeLogs = false;
        }

        if (command.masterAccountId !== undefined) {
            AwsUtil.SetMasterAccountId(command.masterAccountId);
        }

        if (command.isPartition) {
            AwsUtil.SetIsPartition(true);
            if (command.partitionProfile !== undefined) {
                AwsUtil.SetPartitionProfile(command.partitionProfile);
            }
            if (command.partitionRegion) {
                AwsUtil.SetPartitionRegion(command.partitionRegion);
            }
            if (command.partitionKeys) {
                AwsUtil.SetPartitionCredentials();
            }
        }

        AwsUtil.SetProfile(command.profile);

        if (command.debugTemplating) {
            NunjucksDebugSettings.debug = true;
        }
        if (command.profile !== undefined) {
            await AwsUtil.Initialize(fromIni({ profile: command.profile }));
        } else {
            await AwsUtil.Initialize();
        }
        await Promise.all([AwsUtil.GetPartitionFromCurrentSession(), AwsUtil.SetEnabledRegions()]);

        command.initialized = true;
    }

    private loadRuntimeConfiguration(command: ICommandArgs): void {
        const rc = RC('org-formation', {}, {}) as IRCObject;
        if (rc.configs !== undefined) {

            if (rc.organizationFile && rc.config && !rc.organizationFile.startsWith('s3://')) {
                const dir = path.dirname(rc.config);
                const absolutePath = path.join(dir, rc.organizationFile);
                if (absolutePath !== rc.organizationFile) {
                    ConsoleUtil.LogDebug(`organization file from runtime configuration resolved to absolute file path: ${absolutePath} (${rc.config} + ${rc.organizationFile})`);
                    rc.organizationFile = absolutePath;
                }
            }

            if (rc.templatingContext && rc.config) {
                const dir = path.dirname(rc.config);
                const absolutePath = path.join(dir, rc.templatingContext);
                if (absolutePath !== rc.templatingContext) {
                    ConsoleUtil.LogDebug(`templating context file from runtime configuration resolved to absolute file path: ${absolutePath} (${rc.config} + ${rc.templatingContext})`);
                    rc.templatingContext = absolutePath;
                }
            }

            if (rc.printStacksOutputPath && rc.config) {
                const dir = path.dirname(rc.config);
                const absolutePath = path.join(dir, rc.printStacksOutputPath);
                if (absolutePath !== rc.printStacksOutputPath) {
                    ConsoleUtil.LogDebug(`print-stacks output path from runtime configuration resolved to absolute file path: ${absolutePath} (${rc.config} + ${rc.printStacksOutputPath})`);
                    rc.printStacksOutputPath = absolutePath;
                }
            }

            ConsoleUtil.LogDebug(`runtime configuration: \n${JSON.stringify(rc)}`);
            Validator.validateRC(rc);

            if (process.argv.indexOf('--state-bucket-name') === -1 && rc.stateBucketName !== undefined) {
                command.stateBucketName = rc.stateBucketName;
            }

            if (process.argv.indexOf('--state-object') === -1 && rc.stateObject !== undefined) {
                command.stateObject = rc.stateObject;
            }

            if (process.argv.indexOf('--profile') === -1 && rc.profile !== undefined) {
                command.profile = rc.profile;
            }

            if (process.argv.indexOf('--partition-profile') === -1 && rc.partitionProfile !== undefined) {
                command.partitionProfile = rc.partitionProfile;
            }

            if (process.argv.indexOf('--exclude-accounts') === -1 && rc.excludeAccounts !== undefined) {
                command.excludeAccounts = rc.excludeAccounts;
            }

            if (process.argv.indexOf('--partition-region') === -1 && rc.partitionRegion !== undefined) {
                command.partitionProfile = rc.partitionProfile;
            }

            if (process.argv.indexOf('--organization-file') === -1 && rc.organizationFile !== undefined) {
                (command as IPerformTasksCommandArgs).organizationFile = rc.organizationFile;
            }

            if (process.argv.indexOf('--templating-context-file') === -1 && rc.templatingContext !== undefined) {
                (command as IPerformTasksCommandArgs).TemplatingContext = JSON.parse(readFileSync(rc.templatingContext).toString());
            }

            if (process.argv.indexOf('--output-path') === -1 && rc.printStacksOutputPath !== undefined) {
                (command as IPrintTasksCommandArgs).outputPath = rc.printStacksOutputPath;
            }

            if (process.argv.indexOf('--master-account-id') === -1 && rc.masterAccountId !== undefined) {
                (command as IPerformTasksCommandArgs).masterAccountId = rc.masterAccountId;
            }

            if (process.argv.indexOf('--organization-state-object') === -1 && rc.organizationStateObject !== undefined) {
                (command as IPerformTasksCommandArgs).organizationStateObject = rc.organizationStateObject;
            }

            if (process.argv.indexOf('--organization-state-bucket-name') === -1 && rc.organizationStateBucketName !== undefined) {
                (command as IPerformTasksCommandArgs).organizationStateBucketName = rc.organizationStateBucketName;
            }

            if (process.argv.indexOf('--debug-templating') === -1 && rc.debugTemplating !== undefined) {
                (command as IPerformTasksCommandArgs).debugTemplating = rc.debugTemplating;
            }
        }

    }
}

export interface ICommandArgs {
    color?: boolean;
    debugTemplating?: boolean;
    dev?: boolean;
    excludeAccounts?: string;
    initialized?: boolean;
    isPartition?: boolean;
    masterAccountId?: string;
    organizationState?: PersistedState;
    organizationStateBucketName?: string;
    organizationStateObject?: string;
    partitionKeys?: boolean;
    partitionProfile?: string;
    partitionRegion?: string;
    printStack?: boolean;
    profile?: string;
    resolver?: CfnExpressionResolver;
    state?: PersistedState;
    stateBucketName: string;
    stateObject: string;
    verbose?: boolean;
}

export interface IRCObject {
    config: string;
    configs: string[];
    debugTemplating?: boolean;
    excludeAccounts?: string;
    masterAccountId?: string;
    organizationFile?: string;
    organizationStateBucketName?: string;
    organizationStateObject?: string;
    partitionProfile?: string;
    partitionRegion?: string;
    printStacksOutputPath?: string;
    profile?: string;
    stateBucketName?: string;
    stateObject?: string;
    templatingContext?: string;
}
