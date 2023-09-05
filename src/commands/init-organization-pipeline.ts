import { existsSync, readFileSync } from 'fs';
import archiver = require('archiver');
import * as S3 from '@aws-sdk/client-s3';
import * as CFN from '@aws-sdk/client-cloudformation';
import { Upload } from '@aws-sdk/lib-storage';
import * as Organizations from '@aws-sdk/client-organizations';
import { Command } from 'commander';
import { WritableStream } from 'memory-streams';
import { AwsUtil, CfnUtil, DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS, DEFAULT_ROLE_FOR_ORG_ACCESS } from '../util/aws-util';
import { ConsoleUtil } from '../util/console-util';
import { OrgFormationError } from '../org-formation-error';
import { BaseCliCommand, ICommandArgs } from './base-command';
import { DefaultTemplate, ITemplateGenerationSettings } from '~writer/default-template-writer';
import { ExtractedTemplate, InitialCommitUtil } from '~util/initial-commit-util';
import { ClientCredentialsConfig } from '~util/aws-types';


const commandName = 'init-pipeline';
const commandDescription = 'initializes organization and created codecommit repo, codebuild and codepipeline';

export class InitPipelineCommand extends BaseCliCommand<IInitPipelineCommandArgs> {
    private currentAccountId: string;
    private buildAccountId: string;
    private s3credentials: ClientCredentialsConfig;

    constructor(command: Command) {
        super(command, commandName, commandDescription);
    }

    public addOptions(command: Command): void {
        command.option('--region <region>', 'region used to created state-bucket and pipeline in');
        command.option('--stack-name <stack-name>', 'stack name used to create pipeline artifacts', 'organization-formation-build');
        command.option('--resource-prefix <resource-prefix>', 'name prefix used when creating AWS resources', 'organization-formation');
        command.option('--repository-name <repository-name>', 'name of the code commit repository created', 'organization-formation');
        command.option('--cross-account-role-name <cross-account-role-name>', 'name of the role used to perform cross account access', 'OrganizationAccountAccessRole');
        command.option('--build-account-id [build-account-id]', 'account id of the aws account that will host the orgformation build process');
        command.option('--role-stack-name [role-stack-name]', 'stack name used to create cross account roles for org-formation access. only used when --build-account-id is passed', 'organization-formation-role');
        command.option('--template-package-url [template-package-url]', 'url of a package that could be used as an initial set of templates');

        super.addOptions(command);
    }

    public async performCommand(command: IInitPipelineCommandArgs): Promise<void> {

        // in this context currentAccountId is the master account
        this.currentAccountId = await AwsUtil.GetMasterAccountId();
        this.buildAccountId = this.currentAccountId;

        await this.checkRunInMasterAccount();

        command.delegateToBuildAccount = (command.buildAccountId !== undefined && this.currentAccountId !== command.buildAccountId);
        if (command.delegateToBuildAccount) {
            command.buildProcessRoleName = 'OrganizationFormationBuildAccessRole';
            this.buildAccountId = command.buildAccountId;
            this.s3credentials = await AwsUtil.GetCredentials(command.buildAccountId, DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS.RoleName);
        }
        if (command.crossAccountRoleName) {
            DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS.RoleName = command.crossAccountRoleName;
            DEFAULT_ROLE_FOR_ORG_ACCESS.RoleName = command.crossAccountRoleName;
        }

        const region = command.region ?? AwsUtil.GetDefaultRegion(command.profile);

        const resourcePrefix = command.resourcePrefix;
        const stackName = command.stackName;
        const repositoryName = command.repositoryName;

        const storageProvider = await this.createOrGetStateBucket(command, region, this.buildAccountId, this.s3credentials);
        const stateBucketName = storageProvider.bucketName;

        const codePipelineTemplateFileName = 'orgformation-codepipeline.yml';
        let path = __dirname + '/../../../resources/';
        if (!existsSync(path + codePipelineTemplateFileName)) {
            path = __dirname + '/../../resources/';
        }

        const cloudformationTemplateContents = readFileSync(path + codePipelineTemplateFileName).toString('utf8');
        let templateGenerationSettings: ITemplateGenerationSettings = { predefinedAccounts: [], predefinedOUs: [] };
        let extractedTemplate: ExtractedTemplate | undefined;
        if (command.templatePackageUrl) {
            extractedTemplate = await InitialCommitUtil.extractTemplate(command.templatePackageUrl);
            if (extractedTemplate.definition.templateGenerationSettings) {
                templateGenerationSettings = JSON.parse(JSON.stringify(extractedTemplate.definition.templateGenerationSettings));
                for (const acc of templateGenerationSettings.predefinedAccounts) {
                    if (!command.logicalNameToIdMap || !command.logicalNameToIdMap[acc.logicalName]) {
                        throw new OrgFormationError(`account ${acc.logicalName} not present in logicalNameToId map`);
                    }
                    if (!command.logicalNameToRootEmailMap || !command.logicalNameToRootEmailMap[acc.logicalName]) {
                        throw new OrgFormationError(`account ${acc.logicalName} not present in logicalNameToRootEmail map`);
                    }
                    acc.properties.RootEmail = command.logicalNameToRootEmailMap[acc.logicalName];
                    acc.id = command.logicalNameToIdMap[acc.logicalName];
                }
                for (const ou of templateGenerationSettings.predefinedOUs) {
                    if (!command.logicalNameToIdMap || !command.logicalNameToIdMap[ou.logicalName]) {
                        throw new OrgFormationError(`ou ${ou.logicalName} not present in logicalNameToId map`);
                    }
                    ou.id = command.logicalNameToIdMap[ou.logicalName];
                }
            }
        }

        const template = await this.generateDefaultTemplate(command.buildProcessRoleName, templateGenerationSettings);

        if (extractedTemplate) {
            await this.createInitialCommitFromUrl(template, command.packageParameters ?? {}, extractedTemplate, region, stateBucketName, resourcePrefix);
        } else {
            await this.createInitialCommitFromResources(path, template, resourcePrefix, stateBucketName, stackName, repositoryName, region, command);
        }

        ConsoleUtil.LogInfo('creating codecommit / codebuild and codepipeline resources using CloudFormation...');
        await this.executePipelineStack(this.buildAccountId, cloudformationTemplateContents, region, stateBucketName, resourcePrefix, stackName, repositoryName);

        await template.state.save(storageProvider);

        await AwsUtil.DeleteObject(stateBucketName, 'initial-commit.zip', this.s3credentials);

        ConsoleUtil.LogInfo('');
        ConsoleUtil.LogInfo('Your pipeline and initial commit have been created in AWS.');
        ConsoleUtil.LogInfo('Hope this will get you started!');
        ConsoleUtil.LogInfo('');
        ConsoleUtil.LogInfo('Take your time and browse through the source, there is some additional guidance as comments.');
        ConsoleUtil.LogInfo('');
        ConsoleUtil.LogInfo('Have fun!');
        ConsoleUtil.LogInfo('');
        ConsoleUtil.LogInfo('--OC');
    }

    private async createInitialCommitFromUrl(template: DefaultTemplate, additionalParameters: Record<string, string>, templateDefinition: ExtractedTemplate, region: string, stateBucketName: string, resourcePrefix: string): Promise<void> {
        const parameters: Record<string, string> = {
            ManagementAcctId: this.currentAccountId,
            PrimaryAwsRegion: region,
            StateBucketName: stateBucketName,
            ResourcePrefix: resourcePrefix,
            ...additionalParameters,
        };
        await InitialCommitUtil.parameterizeAndUpload(templateDefinition, parameters, template, stateBucketName, this.s3credentials);

    }
    private async createInitialCommitFromResources(path: string, template: DefaultTemplate, resourcePrefix: string, stateBucketName: string, stackName: string, repositoryName: string, region: string, command: IInitPipelineCommandArgs): Promise<void> {
        const codePipelineTemplateFileName = 'orgformation-codepipeline.yml';

        const replacements: Record<string, string> = {};
        replacements['XXX-resourcePrefix'] = resourcePrefix;
        replacements['XXX-stateBucketName'] = stateBucketName;
        replacements['XXX-stackName'] = this.createValuePossiblyWithResourcePrefix(stackName, resourcePrefix);
        replacements['XXX-repositoryName'] = this.createValuePossiblyWithResourcePrefix(repositoryName, resourcePrefix);
        replacements['XXX-region'] = region;
        replacements['XXX-stackName-role-id'] = this.createValuePossiblyWithResourcePrefix(stackName + '-role-id', resourcePrefix);
        replacements['XXX-roleStackName-master'] = this.createValuePossiblyWithResourcePrefix(command.roleStackName + '-master', resourcePrefix);
        replacements['XXX-organizationAccountAccessRoleName'] = command.crossAccountRoleName;
        replacements['XXX-roleStackName'] = this.createValuePossiblyWithResourcePrefix(command.roleStackName, resourcePrefix);

        if (command.delegateToBuildAccount) {
            const buildAccountLogicalId = template.state.getLogicalIdForPhysicalId(command.buildAccountId);

            if (buildAccountLogicalId === undefined) {
                throw new OrgFormationError(`account with id ${command.buildAccountId} does not exist in organization`);
            }
            replacements['XXX-organizationFormationBuildAccessRoleName'] = command.buildProcessRoleName;
            replacements['XXX-buildAccountLogicalName'] = buildAccountLogicalId;
        }

        const buildSpecContents = this.createBuildSpecContents(path, command, stateBucketName);
        const cloudformationTemplateContents = readFileSync(path + codePipelineTemplateFileName).toString('utf8');
        const organizationTasksContents = command.delegateToBuildAccount
            ? this.replaceContents(path + 'delegated-build-orgformation-tasks.yml', replacements)
            : this.replaceContents(path + 'local-build-orgformation-tasks.yml', replacements);

        const buildAccessRoleTemplate = command.delegateToBuildAccount
            ? this.createBuildAccessRoleTemplate(path, command.buildProcessRoleName)
            : undefined;

        const orgParametersInclude = this.replaceContents(path + 'organization-parameters.yml', replacements);

        if (command.delegateToBuildAccount) {
            await this.executeOrgFormationRoleStack(this.currentAccountId, this.buildAccountId, buildAccessRoleTemplate, region, command.roleStackName + '-master');
            await this.executeOrgFormationRoleStack(this.buildAccountId, this.buildAccountId, buildAccessRoleTemplate, region, command.roleStackName);
        }

        ConsoleUtil.LogInfo(`uploading initial commit to S3 ${stateBucketName}/initial-commit.zip...`);
        await this.uploadInitialCommit(stateBucketName, path + 'initial-commit/', template.template, buildSpecContents, organizationTasksContents, cloudformationTemplateContents, orgParametersInclude, buildAccessRoleTemplate);
    }

    public uploadInitialCommit(stateBucketName: string, initialCommitPath: string, templateContents: string, buildSpecContents: string, organizationTasksContents: string, cloudformationTemplateContents: string, orgParametersInclude: string, buildAccessRoleTemplateContents: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const s3client = new S3.S3Client({ ...(this.s3credentials ? { credentials: this.s3credentials } : {}) });
                const output = new WritableStream();
                const archive = archiver('zip');

                archive.on('error', reject);

                archive.on('end', () => {
                    const uploadRequest: S3.PutObjectCommandInput = {
                        Body: output.toBuffer(),
                        Key: 'initial-commit.zip',
                        Bucket: stateBucketName,
                    };

                    new Upload({
                      client: s3client,
                      params: uploadRequest,
                    })
                      .done()
                      .then(() => resolve())
                      .catch(reject);

                });

                archive.pipe(output);
                archive.directory(initialCommitPath, false);
                archive.append(buildSpecContents, { name: 'buildspec.yml' });
                archive.append(templateContents, { name: 'organization.yml' });
                archive.append(orgParametersInclude, { name: 'organization-parameters.yml' });
                archive.append(organizationTasksContents, { name: '000-organization-build/organization-tasks.yml' });
                archive.append(cloudformationTemplateContents, { name: '000-organization-build/org-formation-build.yml' });
                if (buildAccessRoleTemplateContents !== undefined) {
                    archive.append(buildAccessRoleTemplateContents, { name: '000-organization-build/org-formation-role.yml' });
                }

                archive.finalize();
            } catch (err) {
                reject(err);
            }
        });
    }

    public async executeOrgFormationRoleStack(targetAccountId: string, buildAccountId: string, cfnTemplate: string, region: string, stackName: string): Promise<void> {
        try {
            const cfn = AwsUtil.GetCloudFormation(targetAccountId, region, DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS.RoleName);
            const stackInput: CFN.CreateStackCommandInput | CFN.UpdateStackCommandInput = {
                StackName: stackName,
                TemplateBody: cfnTemplate,
                Capabilities: ['CAPABILITY_NAMED_IAM', 'CAPABILITY_IAM'],
                Parameters: [
                    { ParameterKey: 'assumeRolePrincipal', ParameterValue: buildAccountId },
                ],
            };

            await CfnUtil.UpdateOrCreateStack(cfn, stackInput);
        } catch (err) {
            throw new OrgFormationError(`unable to create stack ${stackName} in account ${targetAccountId}, region ${region}, err: ${err}`);
        }
    }

    public async executePipelineStack(targetAccountId: string, cfnTemplate: string, region: string, stateBucketName: string, resourcePrefix: string, stackName: string, repositoryName: string): Promise<void> {
        try {
            const cfn = AwsUtil.GetCloudFormation(targetAccountId, region, DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS.RoleName);
            const stackInput: CFN.CreateStackCommandInput | CFN.UpdateStackCommandInput = {
                StackName: stackName,
                TemplateBody: cfnTemplate,
                Capabilities: ['CAPABILITY_NAMED_IAM', 'CAPABILITY_IAM'],
                Parameters: [
                    { ParameterKey: 'stateBucketName', ParameterValue: stateBucketName },
                    { ParameterKey: 'resourcePrefix', ParameterValue: resourcePrefix },
                    { ParameterKey: 'repositoryName', ParameterValue: repositoryName },
                ],
            };

            await CfnUtil.UpdateOrCreateStack(cfn, stackInput);
        } catch (err) {
            throw new OrgFormationError(`unable to create stack ${stackName} in account ${targetAccountId}, region ${region}, err: ${err}`);
        }
    }

    private replaceContents(filePath: string, replacements: Record<string, string>): string {
        let contents = readFileSync(filePath).toString('utf-8');

        const entries = Object.entries(replacements);
        const sorted = entries.sort((x, y) => y[0].length - x[0].length);
        for (const [key, val] of sorted) {
            contents = contents.replace(new RegExp(key, 'g'), val);
        }

        return contents;
    }
    private createBuildAccessRoleTemplate(path: string, buildProcessRoleName: string): string {
        let buildSpecContents = readFileSync(path + 'orgformation-build-access-role.yml').toString('utf-8');

        buildSpecContents = buildSpecContents.replace('XXX-OrganizationFormationBuildAccessRole', buildProcessRoleName);

        return buildSpecContents;
    }
    private createBuildSpecContents(path: string, command: IInitPipelineCommandArgs, stateBucketName: string): string {
        let buildSpecContents = readFileSync(path + 'buildspec.yml').toString('utf-8');

        buildSpecContents = buildSpecContents.replace('XXX-ARGS', '--state-bucket-name ' + stateBucketName + ' XXX-ARGS');

        if (command.stateObject) {
            buildSpecContents = buildSpecContents.replace('XXX-ARGS', '--state-object ' + command.stateObject + ' XXX-ARGS');
        }

        if (command.delegateToBuildAccount) {
            buildSpecContents = buildSpecContents.replace('XXX-ARGS', '--master-account-id ' + this.currentAccountId + ' XXX-ARGS');
        }

        buildSpecContents = buildSpecContents.replace('XXX-ARGS', '');
        return buildSpecContents;
    }

    public async checkRunInMasterAccount(): Promise<void> {
        try {
            const org = new Organizations.OrganizationsClient({ region: 'us-east-1' });
            const result = await org.send(new Organizations.DescribeOrganizationCommand({}));
            if (result.Organization.MasterAccountId !== this.currentAccountId) {
                throw new OrgFormationError('init-pipeline command must be ran from organization master account');
            }
        } catch (err) {
            throw new OrgFormationError('init-pipeline command must be ran from organization master account');
        }
    }


    private createValuePossiblyWithResourcePrefix(val: string, resourcePrefix: string): string {
        if (val.startsWith(resourcePrefix)) {
            return '!Sub "${resourcePrefix}' + val.replace(resourcePrefix, '') + '"';
        }

        return val;
    }
}

export interface IInitPipelineCommandArgs extends ICommandArgs {
    region: string;
    stackName: string;
    resourcePrefix: string;
    repositoryName: string;
    crossAccountRoleName: string;
    buildAccountId?: string;
    roleStackName: string;
    buildProcessRoleName: string;
    delegateToBuildAccount: boolean;
    templatePackageUrl?: string;
    logicalNameToIdMap?: Record<string, string>;
    logicalNameToRootEmailMap?: Record<string, string>;
    packageParameters?: Record<string, string>;
}
