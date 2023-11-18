import * as CFN from '@aws-sdk/client-cloudformation';
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
const communityResourceProviderCatalogGov = 'community-resource-provider-catalog-gov';

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

        return {
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
        return {
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

    getPhysicalIdForCleanup(command: IRpBuildTaskConfig): string | undefined {
        return command.ResourceType;
    }

    async performRemove(binding: IPluginBinding<IRpTask> /* , resolver: CfnExpressionResolver*/): Promise<void> {
        const cfn = AwsUtil.GetCloudFormationService(binding.target.accountId, binding.target.region, binding.task.taskRoleName, null, AwsUtil.GetIsPartition());
        let listVersionsResponse: CFN.ListTypeVersionsCommandOutput;
        do {
            listVersionsResponse = await cfn.send(
                new CFN.ListTypeVersionsCommand({
                    Type: 'RESOURCE',
                    TypeName: binding.task.resourceType,
                    NextToken: listVersionsResponse?.NextToken,
                }));
            for (const version of listVersionsResponse.TypeVersionSummaries) {
                if (!version.IsDefaultVersion) {
                    await cfn.send(
                        new CFN.DeregisterTypeCommand({
                            Type: 'RESOURCE',
                            TypeName: binding.task.resourceType,
                            VersionId: version.VersionId,
                        }),
                    );
                }
            }
        } while (listVersionsResponse.NextToken);
        await cfn.send(new CFN.DeregisterTypeCommand({ Type: 'RESOURCE', TypeName: binding.task.resourceType }));
    }

    async performCreateOrUpdate(binding: IPluginBinding<IRpTask> /* , resolver: CfnExpressionResolver */): Promise<void> {

        const { task, target, previousBindingLocalHash } = binding;
        if (task.forceDeploy !== true &&
            task.taskLocalHash !== undefined &&
            task.taskLocalHash === previousBindingLocalHash) {

            ConsoleUtil.LogDebug(`Workload (${this.typeForTask}) ${task.name} in ${target.accountId}/${target.region} skipped, task itself did not change. Use ForceTask to force deployment.`);
            return;
        }

        const catalog = this.getCatalogBucket(AwsUtil.GetIsPartition());

        const cfn = AwsUtil.GetCloudFormationService(target.accountId, target.region, task.taskRoleName, task.taskViaRoleArn, AwsUtil.GetIsPartition());

        let roleArn = task.executionRole;
        const schemaHandlerPackage = task.schemaHandlerPackage;

        if (roleArn === undefined) {
            roleArn = await this.ensureExecutionRole(cfn, schemaHandlerPackage, catalog);
        }

        await retryTypeRegistrationWrapper(task.resourceType, async () => {
            const response = await cfn.send(new CFN.RegisterTypeCommand({
                TypeName: task.resourceType,
                Type: 'RESOURCE',
                SchemaHandlerPackage: task.schemaHandlerPackage,
                ExecutionRoleArn: roleArn,
            }));

            let registrationStatus: CFN.DescribeTypeRegistrationCommandOutput;
            do {
                await sleep(3000);
                registrationStatus = await cfn.send(new CFN.DescribeTypeRegistrationCommand({ RegistrationToken: response.RegistrationToken }));
            } while (registrationStatus.ProgressStatus === 'IN_PROGRESS');

            if (registrationStatus.ProgressStatus !== 'COMPLETE') {
                throw new OrgFormationError(`Registration of Resource Type ${task.resourceType} failed. ${registrationStatus.Description}`);
            }
            await cfn.send(new CFN.SetTypeDefaultVersionCommand({ Arn: registrationStatus.TypeVersionArn }));
        });
    }

    private async ensureExecutionRole(cfn: CFN.CloudFormationClient, handlerPackageUrl: string, catalog: Catalog): Promise<string> {
        if (handlerPackageUrl === undefined || !handlerPackageUrl.startsWith(catalog.uri)) {
            throw new OrgFormationError('Can only automatically install ExecutionRole for resource providers hosted on community-resource-provider-catalog or community-resource-provider-catalog-gov. As a workaround, you can use the native CloudFormation resource to register the type: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-cloudformation-resourceversion.html');
        }

        const { name, version } = this.getResourceRoleName(handlerPackageUrl, catalog);
        const updateStackInput: CFN.UpdateStackCommandInput = {
            StackName: name,
            TemplateURL: `${catalog.path}${name}-${version}.yml`,
            Capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
        };
        const stacks = await CfnUtil.UpdateOrCreateStack(cfn, updateStackInput);
        const stack = stacks.Stacks[0];
        const output = stack.Outputs.find(x => x.OutputKey === 'ExecutionRoleArn');

        return output.OutputValue;
    }

    private getResourceRoleName(handlerPackageUrl: string, catalog: Catalog): { name: string; version: string; } {
        const packageNameWithVersion = handlerPackageUrl.replace(catalog.uri, '').replace('.zip', '');
        const packageNameWithVersionParts = packageNameWithVersion.split('-');
        const version = packageNameWithVersionParts[packageNameWithVersionParts.length - 1];
        const nameParts = packageNameWithVersionParts.slice(0, -1);
        const name = nameParts.join('-') + '-resource-role';
        return { name, version };
    }

    private getCatalogBucket(isPartition: boolean): Catalog {
        return {
            bucket: (isPartition) ? communityResourceProviderCatalogGov : communityResourceProviderCatalog,
            uri: (isPartition) ? `s3://${communityResourceProviderCatalogGov}/` : `s3://${communityResourceProviderCatalog}/`,
            path: (isPartition) ? `https://${communityResourceProviderCatalogGov}.s3-us-gov-west-1.amazonaws.com/` : `https://${communityResourceProviderCatalog}.s3.amazonaws.com/`,
        };
    }

    appendResolvers(): Promise<void> {
        return Promise.resolve();
    }
}

const retryTypeRegistrationWrapper = async (type: string, fn: () => Promise<any>): Promise<void> => {
    let retryCount = 0;
    let retryTypeRegistration = false;
    do {
        retryTypeRegistration = false;
        try {
            await fn();
        } catch (err) {
            const message = err.message as string;
            if (message && -1 !== message.indexOf('Deployment is currently in DEPLOY_STAGE of status FAILED')) {
                if (retryCount >= 20) {
                    throw err;
                }

                ConsoleUtil.LogInfo(`Type registration ${type} is in DEPLOY_STAGE of status FAILED. waiting.... `);
                retryCount += 1;
                await sleep(1000 * (26 + (4 * Math.random())));
                retryTypeRegistration = true;

            } else {
                throw err;
            }
        }
    } while (retryTypeRegistration);
};

interface Catalog {
    bucket: string;
    uri: string;
    path: string;
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
