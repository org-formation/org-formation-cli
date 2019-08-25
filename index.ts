
import * as AWS from 'aws-sdk';
import { Organizations } from 'aws-sdk';
import { writeFileSync } from 'fs';
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
import { DefaultTemplateWriter } from './src/writer/default-template-writer';

export async function updateTemplate(templateFile: string, command: ICommandArgs) {
    if (command.profile) {
        const credentials = new AWS.SharedIniFileCredentials({profile: command.profile});
        AWS.config.credentials = credentials;
    }

    const template = TemplateRoot.create(templateFile);
    const state = PersistedState.Load(templateFile + '.state');

    const organizations = new Organizations({region: 'us-east-1'});
    const awsReader = new AwsOrganizationReader(organizations);
    const awsOrganization = new AwsOrganization(awsReader);
    const awsWriter = new AwsOrganizationWriter(organizations, awsOrganization);
    const taskProvider = new TaskProvider(template, state, awsWriter);
    const binder = new OrganizationBinder(template, state, taskProvider);
    const cfnBinder = new CloudFormationBinder(template, state);

    awsOrganization.initialize().then(async () => {
        const tasks = binder.enumBuildTasks();
        console.log(tasks);
        await TaskRunner.RunTasks(tasks);

        const cfnTasks = cfnBinder.enumTasks();
        console.log(cfnTasks);
        await CfnTaskRunner.RunTasks(cfnTasks);

        state.setPreviousTemplate(template.source);
        state.save();
    });

}

export async function generateTemplate(filePath: string, command: ICommandArgs) {
    if (command.profile) {
        const credentials = new AWS.SharedIniFileCredentials({profile: command.profile});
        AWS.config.credentials = credentials;
    }
    const organizations = new Organizations({region: 'us-east-1'});
    const awsReader = new AwsOrganizationReader(organizations);
    const awsOrganization = new AwsOrganization(awsReader);
    const writer = new DefaultTemplateWriter(awsOrganization);
    const template = await writer.generateDefaultTemplate();
    const templateContents = template.template.replace(/( *)-\n\1 {2}/g, '$1- ');
    writeFileSync(filePath, templateContents);

    template.state.setPreviousTemplate(templateContents);
    template.state.save(filePath + '.state');
}

interface ICommandArgs {
    profile: string;
}
