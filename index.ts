
import * as AWS from 'aws-sdk';
import { Organizations, STS } from 'aws-sdk';
import { writeFileSync } from 'fs';
import { AwsOrganization } from './src/aws-provider/aws-organization';
import { AwsOrganizationReader } from './src/aws-provider/aws-organization-reader';
import { AwsOrganizationWriter } from './src/aws-provider/aws-organization-writer';
import { CloudFormationBinder } from './src/cfn-binder/cfn-binder';
import { CfnTaskRunner } from './src/cfn-binder/cfn-task-runner';
import { ChangeSetProvider } from './src/change-set/change-set-provider';
import { BindingRoot, OrganizationBinder } from './src/org-binder/org-binder';
import { TaskRunner } from './src/org-binder/org-task-runner';
import { TaskProvider } from './src/org-binder/org-tasks-provider';
import { OrgFormationError} from './src/org-formation-error';
import { TemplateRoot } from './src/parser/parser';
import { PersistedState } from './src/state/persisted-state';
import { S3StorageProvider } from './src/state/storage-provider';
import { Util } from './src/util';
import { DefaultTemplateWriter } from './src/writer/default-template-writer';

async function HandleErrors(fn: () => {} ) {
    try {
        await fn();
    } catch (err) {
        if (err instanceof OrgFormationError) {
            Util.LogError(err.message);
            return;
        } else {
            if (err.code && err.requestId) {
                Util.LogError(`error: ${err.code}, aws-request-id: ${err.requestId}`);
                Util.LogError(err.message);

            } else {
                Util.LogError(`unexpected error occurred...`, err);
            }
        }
    }
}

export async function updateTemplate(templateFile: string, command: ICommandArgs) {
    await HandleErrors(async () => {
        const template = TemplateRoot.create(templateFile);

        const state = await getState(command);
        const binder = await getOrganizationBinder(template, state);
        const cfnBinder = new CloudFormationBinder(template, state);

        const tasks = binder.enumBuildTasks();
        if (tasks.length === 0) {
            Util.LogInfo('organization up to date, no work to be done.');
        } else  {
            await TaskRunner.RunTasks(tasks);
        }

        // const cfnTasks = cfnBinder.enumTasks();
        // console.log(cfnTasks);
        // await CfnTaskRunner.RunTasks(cfnTasks);

        state.setPreviousTemplate(template.source);
        await state.save();
    });
}

export async function generateTemplate(filePath: string, command: ICommandArgs) {
    await HandleErrors(async () => {
        const storageProvider = await initializeAndGetStorageProvider(command);

        const organizations = new Organizations({region: 'us-east-1'});
        const awsReader = new AwsOrganizationReader(organizations);
        const awsOrganization = new AwsOrganization(awsReader);
        const writer = new DefaultTemplateWriter(awsOrganization);
        const template = await writer.generateDefaultTemplate();
        const templateContents = template.template.replace(/( *)-\n\1 {2}/g, '$1- ');
        writeFileSync(filePath, templateContents);

        template.state.setPreviousTemplate(templateContents);
        await template.state.save(storageProvider);
    });
}

export async function createChangeSet(templateFile: string, command: ICommandArgs) {
    await HandleErrors(async () => {
        const template = TemplateRoot.create(templateFile);

        const state = await getState(command);
        const binder = await getOrganizationBinder(template, state);

        const stateBucketName =  await GetStateBucketName(command);
        const provider = new ChangeSetProvider(stateBucketName);
        const tasks = binder.enumBuildTasks();

        const changeSet = await provider.createChangeSet(command.changeSetName, template, tasks);

        const contents = JSON.stringify(changeSet, null, 2);
        console.log(contents);
    });
}

export async function executeChangeSet(changeSetName: string, command: ICommandArgs) {
    await HandleErrors(async () => {
        initialize(command);
        const stateBucketName = await GetStateBucketName(command);
        const provider = new ChangeSetProvider(stateBucketName);
        const changeSetObj = await provider.getChangeSet(changeSetName);
        if (!changeSetObj) {
            Util.LogError(`change set '${changeSetName}' not found.`);
            return;
        }
        const template = new TemplateRoot(changeSetObj.template, './');
        const state = await getState(command);
        const binder = await getOrganizationBinder(template, state);
        const tasks = binder.enumBuildTasks();
        const changeSet = ChangeSetProvider.CreateChangeSet(tasks, changeSetName);
        if (JSON.stringify(changeSet) !== JSON.stringify(changeSetObj.changeSet)) {
            Util.LogError(`AWS organization state has changed since creating change set.`);
            return;
        }
        await TaskRunner.RunTasks(tasks);
        state.setPreviousTemplate(template.source);
        await state.save();
    });
}

interface ICommandArgs {
    profile: string;
    stateBucketName: string;
    stateObject: string;
    changeSetName: string;
}

async function getOrganizationBinder(template: TemplateRoot, state: PersistedState) {
    const organizations = new Organizations({ region: 'us-east-1' });
    const awsReader = new AwsOrganizationReader(organizations);
    const awsOrganization = new AwsOrganization(awsReader);
    await awsOrganization.initialize();
    const awsWriter = new AwsOrganizationWriter(organizations, awsOrganization);
    const taskProvider = new TaskProvider(template, state, awsWriter);
    const binder = new OrganizationBinder(template, state, taskProvider);
    return binder;
}

async function getState(command: ICommandArgs) {
    const storageProvider = await initializeAndGetStorageProvider(command);
    try {
        const state = await PersistedState.Load(storageProvider);
        return state;
    } catch (err) {
        if (err && err.code === 'NoSuchBucket') {
            throw new OrgFormationError(`unable to load previously committed state, reason: bucket '${storageProvider.bucketName}' does not exist in current account.`);
         }
    }
}

async function initializeAndGetStorageProvider(command: ICommandArgs) {
    initialize(command);
    return GetStorageProvider(command.stateObject, command);
}

function initialize(command: ICommandArgs) {
    if (command.profile) {
        const credentials = new AWS.SharedIniFileCredentials({ profile: command.profile });
        AWS.config.credentials = credentials;
    }
}

async function GetStorageProvider(objectKey: string, command: ICommandArgs) {
    const stateBucketName = await GetStateBucketName(command);
    const storageProvider = await S3StorageProvider.Create(stateBucketName, objectKey, true);
    return storageProvider;
}

async function GetStateBucketName(command: ICommandArgs): Promise<string> {
    const bucketName = command.stateBucketName || 'organization-formation-${AWS::AccountId}';
    if (bucketName.indexOf('${AWS::AccountId}') >= 0) {
        const accountId = await getCurrentAccountId();
        return bucketName.replace('${AWS::AccountId}', accountId );
    }
    return bucketName;
}

async function getCurrentAccountId(): Promise<string> {
    const stsClient = new STS();
    const caller = await stsClient.getCallerIdentity().promise();
    return caller.Account;
}
