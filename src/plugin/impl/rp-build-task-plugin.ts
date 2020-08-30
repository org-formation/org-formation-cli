import { DescribeTypeRegistrationOutput, ListTypeVersionsOutput } from 'aws-sdk/clients/cloudformation';
import { IOrganizationBinding } from '~parser/parser';
import { IBuildTaskConfiguration } from '~build-tasks/build-configuration';
import { IBuildTaskPluginCommandArgs, IBuildTaskPlugin, CommonTaskAttributeNames } from '~plugin/plugin';
import { IPluginTask, IPluginBinding } from '~plugin/plugin-binder';
import { IPerformTasksCommandArgs } from '~commands/index';
import { Validator } from '~parser/validator';
import { OrgFormationError } from '~org-formation-error';
import { AwsUtil } from '~util/aws-util';


export class RpBuildTaskPlugin implements IBuildTaskPlugin<IRpBuildTaskConfig, IRpCommandArgs, IRpTask> {
    type = 'register-type';
    typeForTask = 'register-type';

    convertToCommandArgs(config: IRpBuildTaskConfig, command: IPerformTasksCommandArgs): IRpCommandArgs {

        Validator.ThrowForUnknownAttribute(config, config.LogicalName, ...CommonTaskAttributeNames, 'Path',
           'FailedTaskTolerance', 'MaxConcurrentTasks', 'RoleArn', 'ResourceType', 'SchemaHandlerPackage');

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
        };
    }

    validateCommandArgs(command: IRpCommandArgs): void {
        if (typeof command.resourceType !== 'string') {
            throw new OrgFormationError(`task ${command.name} does not have required attribute ResourceType`);
        }

    }

    getValuesForEquality(command: IRpCommandArgs): any {
        return  {
            resourceType: command.resourceType,
            schemaHandlerPackage: command.schemaHandlerPackage,
        };
    }

    convertToTask(command: IRpCommandArgs, hashOfTask: string): IRpTask {
        return {
            schemaHandlerPackage: command.schemaHandlerPackage,
            resourceType: command.resourceType,
            name: command.name,
            hash: hashOfTask,
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
        const cfn = await AwsUtil.GetCloudFormation(binding.target.accountId, binding.target.region, binding.task.taskRoleName);

        const response = await cfn.registerType({
            TypeName: binding.task.resourceType,
            Type: 'RESOURCE',
            SchemaHandlerPackage: binding.task.schemaHandlerPackage,
        }).promise();

        let registrationStatus: DescribeTypeRegistrationOutput = {};
        do {
            await sleep(3000);
            registrationStatus = await cfn.describeTypeRegistration({RegistrationToken: response.RegistrationToken}).promise();
        }while(registrationStatus.ProgressStatus === 'IN_PROGRESS');

        if (registrationStatus.ProgressStatus !== 'COMPLETE') {
            throw new OrgFormationError(`Registration of Resource Type ${binding.task.resourceType} failed. ${registrationStatus.Description}`);
        }

        await cfn.setTypeDefaultVersion({Arn: registrationStatus.TypeVersionArn});
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
}

export interface IRpCommandArgs extends IBuildTaskPluginCommandArgs {
    schemaHandlerPackage: string;
    resourceType: string;
}


export interface IRpTask extends IPluginTask {
    schemaHandlerPackage: string;
    resourceType: string;
}

const sleep = (time: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, time));
};
