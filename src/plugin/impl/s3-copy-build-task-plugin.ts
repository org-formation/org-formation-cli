import path from 'path';
import { existsSync, statSync } from 'fs';
import * as fs from 'fs';
import * as S3 from '@aws-sdk/client-s3';
import archiver from 'archiver';
import { WritableStream } from 'memory-streams';
import { StreamingBlobPayloadInputTypes } from '@smithy/types';
import { IPluginTask, IPluginBinding } from '../plugin-binder';
import { IBuildTaskPluginCommandArgs, IBuildTaskPlugin, CommonTaskAttributeNames } from '../plugin';
import { OrgFormationError } from '../../../src/org-formation-error';
import { IBuildTaskConfiguration } from '~build-tasks/build-configuration';
import { IPerformTasksCommandArgs } from '~commands/index';
import { Md5Util } from '~util/md5-util';
import { IOrganizationBinding } from '~parser/parser';
import { AwsUtil } from '~util/aws-util';
import { Validator } from '~parser/validator';
import { nunjucksRender } from '~yaml-cfn/index';

export class CopyToS3TaskPlugin implements IBuildTaskPlugin<IS3CopyBuildTaskConfig, IS3CopyCommandArgs, IS3CopyTask> {
    type = 'copy-to-s3';
    typeForTask = 'copy-to-s3';

    convertToCommandArgs(config: IS3CopyBuildTaskConfig, command: IPerformTasksCommandArgs): IS3CopyCommandArgs {
        Validator.ThrowForUnknownAttribute(config, config.LogicalName, ...CommonTaskAttributeNames, 'LocalPath', 'RemotePath',
            'FilePath', 'ZipBeforePut', 'ServerSideEncryption', 'TemplatingContext');

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
            serverSideEncryption: config.ServerSideEncryption,
            templatingContext: config.TemplatingContext,
        };
    }
    validateCommandArgs(commandArgs: IS3CopyCommandArgs): void {
        if (!commandArgs.organizationBinding) {
            throw new OrgFormationError(`task ${commandArgs.name} does not have required attribute OrganizationBinding`);
        }

        if (!existsSync(commandArgs.localPath)) {
            throw new OrgFormationError(`task ${commandArgs.name} cannot find path ${commandArgs.localPath}`);
        }

        if (commandArgs.templatingContext && commandArgs.zipBeforePut) {
            throw new OrgFormationError(`task ${commandArgs.name} can not use zipBeforePut and templatingContext together.`);
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
            serverSideEncryption: commandArgs.serverSideEncryption,
            templatingContext: commandArgs.templatingContext,
        };
    }
    convertToTask(command: IS3CopyCommandArgs, globalHash: string): IS3CopyTask {
        return {
            type: this.type,
            name: command.name,
            localPath: command.localPath,
            remotePath: command.remotePath,
            zipBeforePut: command.zipBeforePut,
            templatingContext: command.templatingContext,
            hash: globalHash,
            taskRoleName: command.taskRoleName,
            forceDeploy: typeof command.forceDeploy === 'boolean' ? command.forceDeploy : false,
            logVerbose: typeof command.verbose === 'boolean' ? command.verbose : false,
            serverSideEncryption: command.serverSideEncryption,
        };
    }
    getPhysicalIdForCleanup(): string {
        return undefined;
    }

    async performRemove(binding: IPluginBinding<IS3CopyTask>): Promise<void> {
        const { target, task } = binding;

        Validator.throwForUnresolvedExpressions(task.remotePath, 'RemotePath');
        Validator.throwForUnresolvedExpressions(task.localPath, 'LocalPath');

        const s3client = await AwsUtil.GetS3Service(target.accountId, target.region, task.taskRoleName);
        const request: S3.DeleteObjectCommandInput = {
            ...CopyToS3TaskPlugin.getBucketAndKey(task),
        };

        await s3client.send(new S3.DeleteObjectCommand(request));
    }

    async performCreateOrUpdate(binding: IPluginBinding<IS3CopyTask>): Promise<void> {
        const { target, task } = binding;

        Validator.throwForUnresolvedExpressions(task.remotePath, 'RemotePath');
        Validator.throwForUnresolvedExpressions(task.localPath, 'LocalPath');

        const s3client = await AwsUtil.GetS3Service(target.accountId, target.region, task.taskRoleName);
        const request: S3.PutObjectCommandInput = {
            ...CopyToS3TaskPlugin.getBucketAndKey(task),
            ACL: 'bucket-owner-full-control',
        };
        if (task.serverSideEncryption) {
            request.ServerSideEncryption = task.serverSideEncryption;
        }
        request.Body = await this.createBody(task);

        await s3client.send(new S3.PutObjectCommand(request));
    }

    private async createBody(task: IS3CopyTask): Promise<StreamingBlobPayloadInputTypes> {
        if (!task.zipBeforePut) {
            const fileContent = fs.readFileSync(task.localPath);
            const debugFilename = path.basename(task.localPath);
            if(task.templatingContext) {
                return nunjucksRender(fileContent.toString(), debugFilename, task.templatingContext);
            } else {
                return fileContent;
            }
        } else {
            return await this.createZip(task.localPath);
        }
    }

    private createZip(directory: string): Promise<StreamingBlobPayloadInputTypes> {
        return new Promise<StreamingBlobPayloadInputTypes>((resolve, reject) => {
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

    private static getBucketAndKey(task: IS3CopyTask): IBucketAndKey {
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
    ServerSideEncryption?: S3.ServerSideEncryption | string;
    TemplatingContext?: Record<string, unknown>;
}

export interface IS3CopyCommandArgs extends IBuildTaskPluginCommandArgs {
    localPath: string;
    remotePath: string;
    zipBeforePut: boolean;
    serverSideEncryption?: S3.ServerSideEncryption | string;
    templatingContext?: Record<string, unknown>;
}

export interface IS3CopyTask extends IPluginTask {
    localPath: string;
    remotePath: string;
    zipBeforePut: boolean;
    serverSideEncryption?: S3.ServerSideEncryption | string;
    templatingContext?: Record<string, unknown>;
}
