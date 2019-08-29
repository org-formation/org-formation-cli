
import * as AWS from 'aws-sdk';
import { Organizations } from 'aws-sdk';
import { writeFileSync } from 'fs';
import { v4 } from 'uuid';
import { AwsOrganization } from './src/aws-provider/aws-organization';
import { AwsOrganizationReader } from './src/aws-provider/aws-organization-reader';
import { AwsOrganizationWriter } from './src/aws-provider/aws-organization-writer';
import { CloudFormationBinder } from './src/cfn-binder/cfn-binder';
import { CfnTaskRunner } from './src/cfn-binder/cfn-task-runner';
import { OrganizationBinder } from './src/org-binder/org-binder';
import { TaskRunner } from './src/org-binder/org-task-runner';
import { TaskProvider } from './src/org-binder/org-tasks-provider';
import { TemplateRoot } from './src/parser/parser';
import { PersistedState } from './src/state/persisted-state';
import { S3StorageProvider } from './src/state/storage-provider';
import { DefaultTemplateWriter } from './src/writer/default-template-writer';

export async function updateTemplate(templateFile: string, command: ICommandArgs) {
    const template = TemplateRoot.create(templateFile);

    const state = await getState(command);
    const binder = await getOrganizationBinder(template, state);
    const cfnBinder = new CloudFormationBinder(template, state);

    const tasks = binder.enumBuildTasks();
    console.log(tasks);
    await TaskRunner.RunTasks(tasks);

    const cfnTasks = cfnBinder.enumTasks();
    console.log(cfnTasks);
    await CfnTaskRunner.RunTasks(cfnTasks);

    state.setPreviousTemplate(template.source);
    await state.save();
}

export async function generateTemplate(filePath: string, command: ICommandArgs) {
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
}

export async function createChangeSet(templateFile: string, command: ICommandArgs) {
    const template = TemplateRoot.create(templateFile);

    const state = await getState(command);
    const binder = await getOrganizationBinder(template, state);

    const tasks = binder.enumBuildTasks();
    if (command.changeSetName === 'uuid()') {
        command.changeSetName = undefined;
    }
    const changeSetName = command.changeSetName || v4();
    const changeSet = TaskRunner.CreateChangeSet(tasks, changeSetName);

    const storageProvider = await GetStorageProvider(`change-sets/${changeSetName}`, command);
    const completeDocument = {
        changeSet,
        template: template.contents,
    };

    await storageProvider.put(JSON.stringify(completeDocument, null, 2));

    const contents = JSON.stringify(changeSet, null, 2);
    console.log(contents);
    return changeSet;

}

export async function executeChangeSet(templateFile: string, command: ICommandArgs) {
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
    const state = await PersistedState.Load(storageProvider);
    return state;
}

async function initializeAndGetStorageProvider(command: ICommandArgs) {
    if (command.profile) {
        const credentials = new AWS.SharedIniFileCredentials({ profile: command.profile });
        AWS.config.credentials = credentials;
    }
    return GetStorageProvider(command.stateObject, command);
}

async function GetStorageProvider(objectKey: string, command: ICommandArgs) {
    const stateBucketName = command.stateBucketName || 'organization-formation-${AWS::AccountId}';
    const stateObject = objectKey;
    const storageProvider = await S3StorageProvider.Create(stateBucketName, stateObject);
    return storageProvider;
}
