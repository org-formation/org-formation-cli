import CloudFormation, { DescribeTypeRegistrationOutput, ListTypeVersionsOutput, UpdateStackInput } from 'aws-sdk/clients/cloudformation';
import { IOrganizationBinding } from '~parser/parser';
import { IBuildTaskConfiguration } from '~build-tasks/build-configuration';
import { IBuildTaskPluginCommandArgs, IBuildTaskPlugin, CommonTaskAttributeNames } from '~plugin/plugin';
import { IPluginTask, IPluginBinding } from '~plugin/plugin-binder';
import { IPerformTasksCommandArgs } from '~commands/index';
import { Validator } from '~parser/validator';
import { OrgFormationError } from '~org-formation-error';
import { AwsUtil, CfnUtil } from '~util/aws-util';
import { ConsoleUtil } from '~util/console-util';

const communityResourceProviderCatalog = 'community-resource-provider-catalog';
const communityResourceProviderCatalogS3Path = 's3://' + communityResourceProviderCatalog + '/';

export class RpBuildTaskPlugin implements IBuildTaskPlugin<IRpBuildTaskConfig, IRpCommandArgs, IRpTask> {
    type = 'register-type';
    typeForTask = 'register-type';

    convertToCommandArgs(config: IRpBuildTaskConfig, command: IPerformTasksCommandArgs): IRpCommandArgs {

        Validator.ThrowForUnknownAttribute(config, config.LogicalName, ...CommonTaskAttributeNames, 'Path',
           'FailedTaskTolerance', 'MaxConcurrentTasks', 'RoleArn', 'ResourceType', 'SchemaHandlerPackage',
           'ExecutionRole');

        if (typeof config.SchemaHandlerPackage !== 'string') {
            throw new OrgFormationError(`task ${config.LogicalName} does not have required attribute SchemaHandlerPackage`);
        }

        return  {
            ...command,
            name: config.LogicalName,
            schemaHandlerPackage: config.SchemaHandlerPackage,
            resourceType: config.ResourceType,
            failedTolerance: config.FailedTaskTolerance ?? 0,
            maxConcurrent: config.MaxConcurrentTasks ?? 1,
            organizationBinding: config.OrganizationBinding,
            taskRoleName: config.TaskRoleName,
            executionRole: config.ExecutionRole,
        };
    }

    validateCommandArgs(command: IRpCommandArgs): void {
        if (typeof command.resourceType === 'undefined') {
            throw new OrgFormationError(`task ${command.name} attribute ResourceType is required`);
        }

        if (typeof command.schemaHandlerPackage === 'undefined') {
            throw new OrgFormationError(`task ${command.name} attribute SchemaHandlerPackage is required`);
        }

        if (typeof command.schemaHandlerPackage === 'string' && !command.schemaHandlerPackage.startsWith('s3://')) {
            throw new OrgFormationError(`task ${command.name} SchemaHandlerPackage attribute expected to start with 's3://' (expected format is s3://<bucket>/<path>/<package>.zip). Found: ${command.schemaHandlerPackage}`);
        }
    }

    getValuesForEquality(command: IRpCommandArgs): any {
        return  {
            resourceType: command.resourceType,
            schemaHandlerPackage: command.schemaHandlerPackage,
            executionRole: command.executionRole,
            v: '2',
        };
    }

    convertToTask(command: IRpCommandArgs, globalHash: string): IRpTask {
        return {
            schemaHandlerPackage: command.schemaHandlerPackage,
            resourceType: command.resourceType,
            executionRole: command.executionRole,
            name: command.name,
            hash: globalHash,
            type: this.type,
            forceDeploy: typeof command.forceDeploy === 'boolean' ? command.forceDeploy : false,
            logVerbose: typeof command.verbose === 'boolean' ? command.verbose : false,
        };
    }

    async performRemove(binding: IPluginBinding<IRpTask> /* , resolver: CfnExpressionResolver*/): Promise<void> {
        const cfn = await AwsUtil.GetCloudFormation(binding.target.accountId, binding.target.region, binding.task.taskRoleName);
        let listVersionsResponse: ListTypeVersionsOutput = {};
        do {
            listVersionsResponse = await cfn.listTypeVersions({Type: 'RESOURCE', TypeName: binding.task.resourceType, NextToken: listVersionsResponse.NextToken}).promise();
            for(const version of listVersionsResponse.TypeVersionSummaries) {
                if (!version.IsDefaultVersion) {
                    await cfn.deregisterType({Type: 'RESOURCE', TypeName: binding.task.resourceType, VersionId: version.VersionId}).promise();
                }
            }
        }while(listVersionsResponse.NextToken);
        await cfn.deregisterType({Type: 'RESOURCE', TypeName: binding.task.resourceType}).promise();
    }

    async performCreateOrUpdate(binding: IPluginBinding<IRpTask> /* , resolver: CfnExpressionResolver */): Promise<void> {

        const {task, target } = binding;
        if (task.forceDeploy !== true &&
            task.taskLocalHash !== undefined &&
            task.taskLocalHash === target.lastCommittedLocalHash) {

            ConsoleUtil.LogInfo(`skipping deploy of resource provider ${task.name}, because task itself did not change. Use ForceTask to force deployment.`);
        }


        const cfn = await AwsUtil.GetCloudFormation(target.accountId, target.region, task.taskRoleName);

        let roleArn = task.executionRole;
        const schemaHandlerPackage = task.schemaHandlerPackage;

        if (roleArn === undefined) {
            roleArn = await this.ensureExecutionRole(cfn, schemaHandlerPackage);
        }

        const response = await cfn.registerType({
            TypeName: task.resourceType,
            Type: 'RESOURCE',
            SchemaHandlerPackage: task.schemaHandlerPackage,
            ExecutionRoleArn: roleArn,
        }).promise();

        let registrationStatus: DescribeTypeRegistrationOutput = {};
        do {
            await sleep(3000);
            registrationStatus = await cfn.describeTypeRegistration({RegistrationToken: response.RegistrationToken}).promise();
        }while(registrationStatus.ProgressStatus === 'IN_PROGRESS');

        if (registrationStatus.ProgressStatus !== 'COMPLETE') {
            throw new OrgFormationError(`Registration of Resource Type ${task.resourceType} failed. ${registrationStatus.Description}`);
        }

        await cfn.setTypeDefaultVersion({Arn: registrationStatus.TypeVersionArn}).promise();
    }

    private async ensureExecutionRole(cfn: CloudFormation, handlerPackageUrl: string): Promise<string> {

        if (handlerPackageUrl === undefined || !handlerPackageUrl.startsWith(communityResourceProviderCatalogS3Path)) {
            throw new OrgFormationError('Can only automatically install ExecutionRole for resource providers hosted on community-resource-provider-catalog');
        }

        const { name, version } = this.getResourceRoleName(handlerPackageUrl);
        const updateStackInput: UpdateStackInput = {
            StackName: name,
            TemplateURL: `https://${communityResourceProviderCatalog}.s3.amazonaws.com/${name}-${version}.yml`,
            Capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
        };
        const stacks = await CfnUtil.UpdateOrCreateStack(cfn, updateStackInput);
        const stack = stacks.Stacks[0];
        const output = stack.Outputs.find(x => x.OutputKey === 'ExecutionRoleArn');

        return output.OutputValue;
    }

    private getResourceRoleName(handlerPackageUrl: string): { name: string; version: string }  {
        const packageNameWithVersion = handlerPackageUrl.replace(communityResourceProviderCatalogS3Path, '').replace('.zip', '');
        const packageNameWithVersionParts = packageNameWithVersion.split('-');
        const version = packageNameWithVersionParts[packageNameWithVersionParts.length - 1];
        const nameParts = packageNameWithVersionParts.slice(0, -1);
        const name = nameParts.join('-') + '-resource-role';
        return { name, version };
    }

    appendResolvers(): Promise<void> {
        return Promise.resolve();
    }
}


interface IRpBuildTaskConfig extends IBuildTaskConfiguration {
    SchemaHandlerPackage: string;
    ResourceType: string;
    OrganizationBinding: IOrganizationBinding;
    MaxConcurrentTasks?: number;
    FailedTaskTolerance?: number;
    ExecutionRole?: string;
}

export interface IRpCommandArgs extends IBuildTaskPluginCommandArgs {
    schemaHandlerPackage: string;
    resourceType: string;
    executionRole?: string;
}


export interface IRpTask extends IPluginTask {
    schemaHandlerPackage: string;
    resourceType: string;
    executionRole?: string;
}

const sleep = (time: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, time));
};
