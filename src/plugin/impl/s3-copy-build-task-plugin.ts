import path from 'path';
import { existsSync, statSync } from 'fs';
import * as fs from 'fs';
import S3, { PutObjectRequest, DeleteObjectRequest } from 'aws-sdk/clients/s3';
import archiver from 'archiver';
import { WritableStream } from 'memory-streams';
import { IPluginTask, IPluginBinding } from '../plugin-binder';
import { IBuildTaskPluginCommandArgs, IBuildTaskPlugin, CommonTaskAttributeNames } from '../plugin';
import { OrgFormationError } from '../../../src/org-formation-error';
import { IBuildTaskConfiguration } from '~build-tasks/build-configuration';
import { IPerformTasksCommandArgs } from '~commands/index';
import { Md5Util } from '~util/md5-util';
import { IOrganizationBinding } from '~parser/parser';
import { AwsUtil } from '~util/aws-util';
import { Validator } from '~parser/validator';

export class CopyToS3TaskPlugin implements IBuildTaskPlugin<IS3CopyBuildTaskConfig, IS3CopyCommandArgs, IS3CopyTask> {
    type = 'copy-to-s3';
    typeForTask = 'copy-to-s3';

    convertToCommandArgs(config: IS3CopyBuildTaskConfig, command: IPerformTasksCommandArgs): IS3CopyCommandArgs {
        Validator.ThrowForUnknownAttribute(config, config.LogicalName, ...CommonTaskAttributeNames, 'LocalPath', 'RemotePath',
            'FilePath', 'ZipBeforePut');


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
        };
    }
    validateCommandArgs(commandArgs: IS3CopyCommandArgs): void {
        if (!commandArgs.organizationBinding) {
            throw new OrgFormationError(`task ${commandArgs.name} does not have required attribute OrganizationBinding`);
        }

        if (!existsSync(commandArgs.localPath)) {
            throw new OrgFormationError(`task ${commandArgs.name} cannot find path ${commandArgs.localPath}`);
        }

        const stat = statSync(commandArgs.localPath);
        if (stat.isDirectory()) {
            if (!commandArgs.zipBeforePut) {
                throw new OrgFormationError(`task ${commandArgs.name} ${commandArgs.localPath} points at a directory. This is only supported if the ZipBeforePut option is set to true.`);
            }
        }

        if (!commandArgs.remotePath) {
            throw new OrgFormationError(`task ${commandArgs.name} does not have required attribute RemotePath`);
        }

    }
    getValuesForEquality(commandArgs: IS3CopyCommandArgs): any {
        const hashOfLocalDirectory = Md5Util.Md5OfPath(commandArgs.localPath);
        return {
            remotePath: commandArgs.remotePath,
            zipBeforePut: commandArgs.zipBeforePut,
            path: hashOfLocalDirectory,
        };
    }
    convertToTask(command: IS3CopyCommandArgs, globalHash: string): IS3CopyTask {
        return {
            type: this.type,
            name: command.name,
            localPath: command.localPath,
            remotePath: command.remotePath,
            zipBeforePut: command.zipBeforePut,
            hash: globalHash,
            taskRoleName: command.taskRoleName,
            forceDeploy: typeof command.forceDeploy === 'boolean' ? command.forceDeploy : false,
            logVerbose: typeof command.verbose === 'boolean' ? command.verbose : false,
        };
    }

    async performRemove(binding: IPluginBinding<IS3CopyTask>): Promise<void> {
        const {target, task} = binding;

        Validator.throwForUnresolvedExpressions(task.remotePath, 'RemotePath');
        Validator.throwForUnresolvedExpressions(task.localPath, 'LocalPath');

        const s3client = await AwsUtil.GetS3Service(target.accountId, target.region, task.taskRoleName);
        const request: DeleteObjectRequest = {
            ...CopyToS3TaskPlugin.getBucketAndKey(task),
        };

        await s3client.deleteObject(request).promise();
    }

    async performCreateOrUpdate(binding: IPluginBinding<IS3CopyTask>): Promise<void> {
        const {target, task} = binding;

        Validator.throwForUnresolvedExpressions(task.remotePath, 'RemotePath');
        Validator.throwForUnresolvedExpressions(task.localPath, 'LocalPath');

        const s3client = await AwsUtil.GetS3Service(target.accountId, target.region, task.taskRoleName);
        const request: PutObjectRequest = {
            ...CopyToS3TaskPlugin.getBucketAndKey(task),
        };
        request.Body = await this.createBody(task);

        await s3client.putObject(request).promise();
    }

    async createBody(task: IS3CopyTask): Promise<S3.Body> {
        if (!task.zipBeforePut) {
            return fs.readFileSync(task.localPath);
        } else {
            return await this.createZip(task.localPath);
        }
    }

    createZip(directory: string): Promise<S3.Body> {
        return new Promise<S3.Body>((resolve, reject) => {
            const output = new WritableStream();
            const archive = archiver('zip');

            archive.on('error', reject);

            archive.on('end', () => {
                resolve(output.toBuffer());
            });

            archive.pipe(output);
            archive.directory(directory, false);
            archive.finalize();
        });
    }

    appendResolvers(): Promise<void> {
        return Promise.resolve();
    }

    static getBucketAndKey(task: IS3CopyTask): IBucketAndKey {
        // s3://bucket/path/to/file
        if (task.remotePath.startsWith('s3://')) {
            const objectPath = task.remotePath.substring(5);
            const parts = objectPath.split('/');
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


export interface IS3CopyBuildTaskConfig extends IBuildTaskConfiguration {
    LocalPath: string;
    RemotePath: string;
    ZipBeforePut?: true;
    OrganizationBinding: IOrganizationBinding;

}

export interface IS3CopyCommandArgs extends IBuildTaskPluginCommandArgs {
    localPath: string;
    remotePath: string;
    zipBeforePut: boolean;
}

export interface IS3CopyTask extends IPluginTask {
    localPath: string;
    remotePath: string;
    zipBeforePut: boolean;
}
