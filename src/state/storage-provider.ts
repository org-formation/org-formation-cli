import { readFileSync, writeFileSync } from 'fs';
import AWS from 'aws-sdk';
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
    private readonly credentials: ClientCredentialsConfig;
    private readonly region: string;
    public dontPut = false;

    private constructor(stateBucketName: string, stateObject: string, credentials?: ClientCredentialsConfig, region?: string) {
        if (!stateBucketName || stateBucketName === '') {
            throw new OrgFormationError('stateBucketName cannot be undefined or empty');
        }
        if (!stateObject || stateObject === '') {
            throw new OrgFormationError('stateObject cannot be undefined or empty');
        }
        this.bucketName = stateBucketName;
        this.objectKey = stateObject;
        this.credentials = credentials ? credentials : AWS.config.credentials;
        this.region = region ? region : 'us-east-1';
    }

    public async create(region: string, throwOnAccessDenied = false): Promise<void> {
        const request: S3.CreateBucketCommandInput = {
            Bucket: this.bucketName,
        };
        if (!region) {
            region = AwsUtil.GetDefaultRegion(BaseCliCommand.CliCommandArgs.profile);
        }

        const s3client = new S3.S3Client({ region, credentials: this.credentials });
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
            if (err && err.code === 'IllegalLocationConstraintException') {
                throw new OrgFormationError(`Unable to create bucket in region ${region}. Is the region spelled correctly?\nIf a bucket with the same name was recently deleted from a different region it could take up to a couple of hours for you to be able to create the same bucket in a different region.`);
            }
            if (err && err.code === 'BucketAlreadyOwnedByYou') {
                return;
            }
            if (err && !throwOnAccessDenied && err.code === 'AccessDenied') {
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

        const s3client = new S3.S3Client({ credentials: this.credentials });
        const request: S3.GetObjectCommandInput = {
            Bucket: this.bucketName,
            Key: this.objectKey,
        };

        try {
            const response = await s3client.send(new S3.GetObjectCommand(request));
            if (!response.Body) { return undefined; }
            const contents = response.Body.transformToString();
            return contents;
        } catch (err) {
            if (err && err.code === 'NoSuchKey') {
                return undefined;
            }
            if (err && err.code === 'NoSuchBucket') {
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
            const s3client = new S3.S3Client({ credentials: this.credentials, region: this.region });
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
                    if (err.code === 'NoSuchBucket' && tryCreateBucket) {
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
