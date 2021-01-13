import { readFileSync, writeFileSync } from 'fs';
import AWS, { S3 } from 'aws-sdk';
import { CreateBucketRequest, GetObjectRequest, PutObjectRequest } from 'aws-sdk/clients/s3';
import { CredentialsOptions } from 'aws-sdk/lib/credentials';
import { OrgFormationError } from '../org-formation-error';
import { ConsoleUtil } from '../util/console-util';

export interface IStorageProvider {
    get(): Promise<string | undefined>;
    put(contents: string): Promise<void>;
    create(region: string): Promise<void>;
}

export class S3StorageProvider implements IStorageProvider {

    public static Create(bucketName: string, objectKey: string, credentials?: CredentialsOptions): S3StorageProvider {
        return new S3StorageProvider(bucketName, objectKey, credentials);
    }

    public readonly bucketName: string;
    public readonly objectKey: string;


    private constructor(stateBucketName: string, stateObject: string, private readonly credentials: CredentialsOptions = AWS.config.credentials) {
        if (!stateBucketName || stateBucketName === '') {
            throw new OrgFormationError('statebucketName cannot be undefined or empty');
        }
        if (!stateObject || stateObject === '') {
            throw new OrgFormationError('stateObject cannot be undefined or empty');
        }
        this.bucketName = stateBucketName;
        this.objectKey = stateObject;
    }

    public async create(region: string, throwOnAccessDenied = false): Promise<void> {
        const request: CreateBucketRequest = {
            Bucket: this.bucketName,
        };
        if (!region) {
            region = 'us-east-1';
        }

        const s3client = new S3({ region, credentials: this.credentials });
        try {
            await s3client.createBucket(request).promise();
            await s3client.putPublicAccessBlock({
                Bucket: this.bucketName, PublicAccessBlockConfiguration: {
                    BlockPublicAcls: true,
                    IgnorePublicAcls: true,
                    BlockPublicPolicy: true,
                    RestrictPublicBuckets: true,
                },
            }).promise();
            await s3client.putBucketEncryption({
                Bucket: this.bucketName, ServerSideEncryptionConfiguration: {
                    Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } }],
                },
            }).promise();
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

        const s3client = new S3({ credentials: this.credentials });
        const request: GetObjectRequest = {
            Bucket: this.bucketName,
            Key: this.objectKey,
        };
        try {
            const response = await s3client.getObject(request).promise();
            if (!response.Body) { return undefined; }
            const contents = response.Body.toString();
            return contents;
        } catch (err) {
            if (err && err.code === 'NoSuchKey') {
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
        try {
            const s3client = new S3({ credentials: this.credentials });
            const putObjectRequest: PutObjectRequest = {
                Bucket: this.bucketName,
                Key: this.objectKey,
                Body: contents,
                ACL: 'bucket-owner-full-control',
            };

            // create a copy of `putObjectRequest` to ensure no circular references
            ConsoleUtil.LogDebug(`putting object to S3: \n${JSON.stringify({
                Bucket: putObjectRequest.Bucket,
                Key: putObjectRequest.Key,
            }, undefined, 2)}`);

            await s3client.putObject(putObjectRequest).promise();
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
