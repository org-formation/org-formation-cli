import { readFileSync } from 'fs';
import { PutObjectRequest, DeleteObjectRequest } from 'aws-sdk/clients/s3';
import { OrgFormationError } from '../../../src/org-formation-error';
import { AwsUtil } from '../../../src/aws-util';
import { GenericBinder, IGenericBinding } from '~core/generic-binder';

export class S3CopyBinder extends GenericBinder<IS3CopyTask> {

    createPerformForDelete(binding: IGenericBinding<IS3CopyTask>): () => Promise<void> {
        return async (): Promise<void> => {
            const s3client = await AwsUtil.GetS3Service(binding.target.accountId, binding.target.region, binding.task.taskRoleName);
            const request: DeleteObjectRequest = {
                ...S3CopyBinder.getBucketAndKey(binding.task),
            };

            await s3client.deleteObject(request).promise();
        };
    }

    createPerformForUpdateOrCreate(binding: IGenericBinding<IS3CopyTask>): () => Promise<void> {
        return async (): Promise<void> => {
            const s3client = await AwsUtil.GetS3Service(binding.target.accountId, binding.target.region, binding.task.taskRoleName);
            const request: PutObjectRequest = {
                ...S3CopyBinder.getBucketAndKey(binding.task),
            };
            request.Body = readFileSync(binding.task.localPath);

            const response = await s3client.putObject(request).promise();
            console.log(response);
        };
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


export interface IS3CopyTask {
    name: string;
    type: string;
    hash: string;
    remotePath: string;
    localPath: string;
    zipBeforePut: boolean;
    taskRoleName?: string;
}
