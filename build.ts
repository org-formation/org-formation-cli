
import * as AWS from 'aws-sdk';
import { Organizations } from 'aws-sdk/clients/all';
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

const credentials = new AWS.SharedIniFileCredentials({profile: 'olafconijn'});
AWS.config.credentials = credentials;

const include = TemplateRoot.create('./resources/include-example.yml');

const template = TemplateRoot.create('./resources/example.yml');
const state = PersistedState.Load('./resources/state.json');

const organizations = new Organizations({region: 'us-east-1'});
const awsReader = new AwsOrganizationReader(organizations);
const awsOrganization = new AwsOrganization(awsReader);
const awsWriter = new AwsOrganizationWriter(organizations, awsOrganization);
const taskProvider = new TaskProvider(template, state, awsWriter);
const binder = new OrganizationBinder(template, state, taskProvider);
const cfnBinder = new CloudFormationBinder(template, state);

awsOrganization.initialize().then(async (x) => {
    const tasks = binder.enumBuildTasks();
    console.log(tasks);
    await TaskRunner.RunTasks(tasks);

    const cfnTasks = cfnBinder.enumTasks();
    console.log(cfnTasks);
    await CfnTaskRunner.RunTasks(cfnTasks);

    state.setPreviousTemplate(template.source);
    state.save();
});
