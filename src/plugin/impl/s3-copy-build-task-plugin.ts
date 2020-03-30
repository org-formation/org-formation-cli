import path from 'path';
import { IPluginTask, IPluginBinding } from "../plugin-binder";
import { IBuildTaskPluginCommandArgs, IBuildTaskPlugin } from "../plugin";
import { IBuildTaskConfiguration } from "~build-tasks/build-configuration";
import { IPerformTasksCommandArgs } from "~commands/index";
import { Md5Util } from '~util/md5-util';
import { existsSync, readFileSync, statSync } from "fs";
import { OrgFormationError } from '../../../src/org-formation-error';
import { IOrganizationBinding } from "~parser/parser";
import { AwsUtil } from '~util/aws-util';
import { PutObjectRequest, DeleteObjectRequest } from 'aws-sdk/clients/s3';

export class CopyToS3TaskPlugin implements IBuildTaskPlugin<IS3CopyBuildTaskConfig, IS3CopyCommandArgs, IS3CopyTask> {
    type = 'copy-to-s3';
    typeForTask = 'copy-to-s3';
    convertToCommandArgs(config: IS3CopyBuildTaskConfig, command: IPerformTasksCommandArgs): IS3CopyCommandArgs {

        if (!config.LocalPath) {
            throw new OrgFormationError(`task ${config.LogicalName} does not have required attribute LocalPath`);
        }

        const dir = path.dirname(config.FilePath);
        const localPath = path.join(dir, config.LocalPath);

        return {
            ...command,
            name: config.LogicalName,
            localPath,
            remotePath: config.RemotePath,
            zipBeforePut: config.ZipBeforePut,
            failedTolerance: 0,
            maxConcurrent: 1,
            organizationBinding: config.OrganizationBinding,
            taskRoleName: config.TaskRoleName,
        }
    }
    validateCommandArgs(commandArgs: IS3CopyCommandArgs): void {
        if (!commandArgs.organizationBinding) {
            throw new OrgFormationError(`task ${commandArgs.name} does not have required attribute OrganizationBinding`);
        }

        if (!existsSync(commandArgs.localPath)) {
            throw new OrgFormationError(`task ${commandArgs.name} cannot find path ${commandArgs.localPath}`);
        }

        const stat = statSync(commandArgs.localPath);
        if (!stat.isFile()) {
            throw new OrgFormationError(`task ${commandArgs.name} ${commandArgs.localPath} is not a file. Only files are supported - for now`);
        }

        if (!commandArgs.remotePath) {
            throw new OrgFormationError(`task ${commandArgs.name} does not have required attribute RemotePath`);
        }

    }
    getValuesForEquality(commandArgs: IS3CopyCommandArgs) {
        const hashOfLocalDirectory = Md5Util.Md5OfPath(commandArgs.localPath);
        return {
            remotePath: commandArgs.remotePath,
            zipBeforePut: commandArgs.zipBeforePut,
            path: hashOfLocalDirectory
        };
    }
    concertToTask(command: IS3CopyCommandArgs, hashOfTask: string): IS3CopyTask {
        return {
            type: this.type,
            name: command.name,
            localPath: command.localPath,
            remotePath: command.remotePath,
            zipBeforePut: command.zipBeforePut,
            hash: hashOfTask,
            taskRoleName: command.taskRoleName,
        };
    }

    async performDelete(binding: IPluginBinding<IS3CopyTask>): Promise<void> {
        const s3client = await AwsUtil.GetS3Service(binding.target.accountId, binding.target.region, binding.task.taskRoleName);
        const request: DeleteObjectRequest = {
            ...CopyToS3TaskPlugin.getBucketAndKey(binding.task),
        };

        await s3client.deleteObject(request).promise();
    }

    async performCreateOrUpdate(binding: IPluginBinding<IS3CopyTask>): Promise<void> {
        const s3client = await AwsUtil.GetS3Service(binding.target.accountId, binding.target.region, binding.task.taskRoleName);
        const request: PutObjectRequest = {
            ...CopyToS3TaskPlugin.getBucketAndKey(binding.task),
        };
        request.Body = readFileSync(binding.task.localPath);

        await s3client.putObject(request).promise();
    }

    static getBucketAndKey(task: IS3CopyTask): IBucketAndKey {
        // s3://bucket/path/to/file
        if (task.remotePath.startsWith('s3://')) {
            const path = task.remotePath.substring(5);
            const parts = path.split('/');
            return {
                Bucket: parts[0],
                Key: parts.slice(1).join('/'),
            };
        }

        throw new OrgFormationError(`expected s3 path to look like s3://bucket/path, but found ${task.remotePath}`);
    }
}

interface IBucketAndKey {
    Bucket: string;
    Key: string;
}


interface IS3CopyBuildTaskConfig extends IBuildTaskConfiguration {
    LocalPath: string;
    RemotePath: string;
    ZipBeforePut?: true;
    OrganizationBinding: IOrganizationBinding;

}

interface IS3CopyCommandArgs extends IBuildTaskPluginCommandArgs {
    localPath: string;
    remotePath: string;
    zipBeforePut: boolean;
}

interface IS3CopyTask extends IPluginTask {
    localPath: string;
    remotePath: string;
    zipBeforePut: boolean;
}