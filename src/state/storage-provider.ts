import { readFileSync, writeFileSync } from 'fs';
import * as S3 from '@aws-sdk/client-s3';
import { OrgFormationError } from '../org-formation-error';
import { ConsoleUtil } from '../util/console-util';
import { AwsUtil } from '~util/aws-util';
import { BaseCliCommand } from '~commands/base-command';
import { ClientCredentialsConfig } from '~util/aws-types';

export interface IStorageProvider {
    get(): Promise<string | undefined>;
    put(contents: string): Promise<void>;
    create(region: string): Promise<void>;
}

export class S3StorageProvider implements IStorageProvider {
    /**
     * Primary changes here have just been adding the ability for a region to get passed in.
     */

    public static Create(bucketName: string, objectKey: string, credentials?: ClientCredentialsConfig, region?: string): S3StorageProvider {
        return new S3StorageProvider(bucketName, objectKey, credentials, region);
    }

    public readonly bucketName: string;
    public readonly objectKey: string;
    private readonly region: string;
    public dontPut = false;

    private constructor(stateBucketName: string, stateObject: string, credentials?: ClientCredentialsConfig, region?: string) {
        if (!stateBucketName || stateBucketName === '') {
            throw new OrgFormationError('stateBucketName cannot be undefined or empty');
        }
        if (!stateObject || stateObject === '') {
            throw new OrgFormationError('stateObject cannot be undefined or empty');
        }

        const defaultRegion = AwsUtil.GetDefaultRegion();

        this.bucketName = stateBucketName;
        this.objectKey = stateObject;
        this.region = region ? region : defaultRegion;
    }

    public async create(region: string, throwOnAccessDenied = false): Promise<void> {
        if (!region) {
            region = AwsUtil.GetDefaultRegion();
        }
        const request: S3.CreateBucketCommandInput = {
            Bucket: this.bucketName,
        };

        // us-east-1 is the default and is not allowed explicitly by AWS
        if (region !== 'us-east-1') {
            request.CreateBucketConfiguration= {
                LocationConstraint: region as S3.BucketLocationConstraint,
            };
        }

        const s3client = AwsUtil.GetS3Service(undefined, region);
        try {
            await s3client.send(new S3.CreateBucketCommand(request));
            await s3client.send(new S3.PutPublicAccessBlockCommand({
                Bucket: this.bucketName, PublicAccessBlockConfiguration: {
                    BlockPublicAcls: true,
                    IgnorePublicAcls: true,
                    BlockPublicPolicy: true,
                    RestrictPublicBuckets: true,
                },
            }));
            await s3client.send(new S3.PutBucketEncryptionCommand({
                Bucket: this.bucketName, ServerSideEncryptionConfiguration: {
                    Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } }],
                },
            }));
        } catch (err) {
            if (err && err.name === 'IllegalLocationConstraintException') {
                throw new OrgFormationError(`Unable to create bucket in region ${region}. Is the region spelled correctly?\nIf a bucket with the same name was recently deleted from a different region it could take up to a couple of hours for you to be able to create the same bucket in a different region.`);
            }
            if (err && err.name === 'BucketAlreadyOwnedByYou') {
                return;
            }
            if (err && !throwOnAccessDenied && err.name === 'AccessDenied') {
                return; // assume bucket has been set up properly
            }
            throw err;
        }
    }

    public async getObject<T>(): Promise<T | undefined> {
        const serialized = await this.get();
        if (!serialized) { return undefined; }

        const obj = JSON.parse(serialized);
        return obj as T;
    }

    public async get(): Promise<string | undefined> {

        const s3client = AwsUtil.GetS3Service();
        const request: S3.GetObjectCommandInput = {
            Bucket: this.bucketName,
            Key: this.objectKey,
        };

        try {
            const response = await s3client.send(new S3.GetObjectCommand(request));
            if (!response.Body) { return undefined; }
            const contents = await response.Body.transformToString('utf-8');
            return contents;
        } catch (err) {
            if (err && err.name === 'NoSuchKey') {
                return undefined;
            }
            if (err && err.name === 'NoSuchBucket') {
                return undefined;
            }
            throw err;
        }

    }

    public async putObject<T>(object: T): Promise<void> {
        const contents = JSON.stringify(object, null, 2);
        await this.put(contents);
    }

    public async put(contents: string): Promise<void> {
        if (this.dontPut) {
            ConsoleUtil.LogInfo('skipped saving updated state to server');
            return;
        }

        try {
            const s3client = AwsUtil.GetS3Service(undefined, this.region);

            const putObjectRequest: S3.PutObjectCommandInput = {
                Bucket: this.bucketName,
                Key: this.objectKey,
                Body: contents,
            };

            // create a copy of `putObjectRequest` to ensure no circular references
            ConsoleUtil.LogDebug(`putting object to S3: \n${JSON.stringify({
                Bucket: putObjectRequest.Bucket,
                Key: putObjectRequest.Key,
            }, undefined, 2)}`);

            let retry = false;
            let tryCreateBucket = true;
            do {
                retry = false;
                try {
                    await s3client.send(new S3.PutObjectCommand(putObjectRequest));
                } catch (err) {
                    if (err.name === 'NoSuchBucket' && tryCreateBucket) {
                        await this.create(this.region);
                        tryCreateBucket = false;
                        retry = true;
                        continue;
                    }
                    throw err;
                }
            } while (retry);
        } catch (err) {
            ConsoleUtil.LogError(`unable to put object to s3 (bucket: ${this.bucketName}, key: ${this.objectKey})`, err);
            throw err;
        }
    }
}

export class FileStorageProvider implements IStorageProvider {
    private readonly filePath: string;

    constructor(filePath: string) {
        this.filePath = filePath;
    }

    public async create(): Promise<void> {
        await Promise.resolve();
    }

    public async get(): Promise<string> {
        try {
            return readFileSync(this.filePath).toString('utf8');
        } catch (err) {
            if (err.code === 'ENOENT') {
                return '';
            } else {
                throw err;
            }
        }
    }
    public async put(contents: string): Promise<void> {
        writeFileSync(this.filePath, contents, { encoding: 'utf8' });
    }
}
