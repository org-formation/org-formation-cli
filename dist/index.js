"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const AWS = __importStar(require("aws-sdk"));
const aws_sdk_1 = require("aws-sdk");
const fs_1 = require("fs");
const aws_organization_1 = require("./src/aws-provider/aws-organization");
const aws_organization_reader_1 = require("./src/aws-provider/aws-organization-reader");
const aws_organization_writer_1 = require("./src/aws-provider/aws-organization-writer");
const cfn_binder_1 = require("./src/cfn-binder/cfn-binder");
const cfn_task_runner_1 = require("./src/cfn-binder/cfn-task-runner");
const org_binder_1 = require("./src/org-binder/org-binder");
const org_task_runner_1 = require("./src/org-binder/org-task-runner");
const org_tasks_provider_1 = require("./src/org-binder/org-tasks-provider");
const parser_1 = require("./src/parser/parser");
const persisted_state_1 = require("./src/state/persisted-state");
const default_template_writer_1 = require("./src/writer/default-template-writer");
async function updateTemplate(templateFile, command) {
    if (command.profile) {
        const credentials = new AWS.SharedIniFileCredentials({ profile: command.profile });
        AWS.config.credentials = credentials;
    }
    const template = parser_1.TemplateRoot.create(templateFile);
    const state = persisted_state_1.PersistedState.Load('./state.json');
    const organizations = new aws_sdk_1.Organizations({ region: 'us-east-1' });
    const awsReader = new aws_organization_reader_1.AwsOrganizationReader(organizations);
    const awsOrganization = new aws_organization_1.AwsOrganization(awsReader);
    const awsWriter = new aws_organization_writer_1.AwsOrganizationWriter(organizations, awsOrganization);
    const taskProvider = new org_tasks_provider_1.TaskProvider(template, state, awsWriter);
    const binder = new org_binder_1.OrganizationBinder(template, state, taskProvider);
    const cfnBinder = new cfn_binder_1.CloudFormationBinder(template, state);
    awsOrganization.initialize().then(async () => {
        const tasks = binder.enumBuildTasks();
        console.log(tasks);
        await org_task_runner_1.TaskRunner.RunTasks(tasks);
        const cfnTasks = cfnBinder.enumTasks();
        console.log(cfnTasks);
        await cfn_task_runner_1.CfnTaskRunner.RunTasks(cfnTasks);
        state.setPreviousTemplate(template.source);
        state.save();
    });
}
exports.updateTemplate = updateTemplate;
async function generateTemplate(filePath, command) {
    if (command.profile) {
        const credentials = new AWS.SharedIniFileCredentials({ profile: command.profile });
        AWS.config.credentials = credentials;
    }
    const organizations = new aws_sdk_1.Organizations({ region: 'us-east-1' });
    const awsReader = new aws_organization_reader_1.AwsOrganizationReader(organizations);
    const awsOrganization = new aws_organization_1.AwsOrganization(awsReader);
    const writer = new default_template_writer_1.DefaultTemplateWriter(awsOrganization);
    const template = await writer.generateDefaultTemplate();
    const templateContents = template.template.replace(/( *)-\n\1 {2}/, '$1- ');
    fs_1.writeFileSync(filePath, templateContents);
}
exports.generateTemplate = generateTemplate;
//# sourceMappingURL=index.js.map