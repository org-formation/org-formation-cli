import { S3 } from 'aws-sdk';
import { CreateBucketRequest, GetObjectRequest, PutObjectRequest } from 'aws-sdk/clients/s3';
import { readFileSync, writeFileSync } from 'fs';
import { OrgFormationError } from '../org-formation-error';

export interface IStorageProvider {
    get(): Promise<string | undefined>;
    put(contents: string): Promise<void>;
    create(region: string): Promise<void>;
}

export class S3StorageProvider implements IStorageProvider {

    public static Create(bucketName: string, objectKey: string): S3StorageProvider {
        return new S3StorageProvider(bucketName, objectKey);
    }

    public readonly bucketName: string;
    public readonly objectKey: string;

    private constructor(stateBucketName: string, stateObject: string) {
        if (!stateBucketName || stateBucketName === '') {
            throw new OrgFormationError(`statebucketName cannot be undefined or empty`);
        }
        if (!stateObject || stateObject === '') {
            throw new OrgFormationError(`stateObject cannot be undefined or empty`);
        }
        this.bucketName = stateBucketName;
        this.objectKey = stateObject;
    }

    public async create(region: string) {
        const request: CreateBucketRequest = {
            Bucket: this.bucketName,
        };
        if (!region) {
            region = 'us-east-1';
        }
        const s3client = new S3({ region });
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

        const s3client = new S3();
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

    public async putObject<T>(object: T) {
        const contents = JSON.stringify(object, null, 2);
        await this.put(contents);
    }

    public async put(contents: string) {
        const s3client = new S3();
        const putObjectRequest: PutObjectRequest = {
            Bucket: this.bucketName,
            Key: this.objectKey,
            Body: contents,
        };

        await s3client.putObject(putObjectRequest).promise();
    }
}

export class FileStorageProvider implements IStorageProvider {
    private readonly filePath: string;

    constructor(filePath: string) {
        this.filePath = filePath;
    }

    public async create(region: string) {
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
    public async put(contents: string) {
        writeFileSync(this.filePath, contents, { encoding: 'utf8' });
    }
}
