import { S3, STS } from 'aws-sdk';
import { CreateBucketRequest, GetObjectRequest, PutObjectRequest } from 'aws-sdk/clients/s3';
import { readFileSync, writeFileSync } from 'fs';

export interface IStorageProvider {
    get(): Promise<string>;
    put(contents: string): Promise<void>;
}

export class S3StorageProvider implements IStorageProvider {

    public static Create(bucketName: string, objectKey: string, createIfBucketDoesntExist: boolean = false, region: string  = 'us-east-1'): S3StorageProvider {
        return new S3StorageProvider(bucketName, objectKey, createIfBucketDoesntExist, region);
    }

    public readonly bucketName: string;
    public readonly objectKey: string;
    private readonly region: string;
    private readonly createIfBucketDoesntExist: boolean;

    private constructor(stateBucketName: string, stateObject: string, createIfBucketDoesntExist: boolean = false, region: string  = 'us-east-1') {
        this.bucketName = stateBucketName;
        this.objectKey = stateObject;
        this.createIfBucketDoesntExist = createIfBucketDoesntExist;
        this.region = region;
    }

    public async getObject<T>(): Promise<T> {
        const serialized = await this.get();
        if (!serialized) { return undefined; }
        try {
            const obj = JSON.parse(serialized);
            return obj as T;
        } catch (err) {
            return undefined;
        }
    }

    public async get(): Promise<string> {

        const s3client = new S3();
        const request: GetObjectRequest =  {
            Bucket: this.bucketName,
            Key: this.objectKey,
        };
        try {
            const response = await s3client.getObject(request).promise();
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
        const putObjectRequest: PutObjectRequest =  {
            Bucket: this.bucketName,
            Key: this.objectKey,
            Body: contents,
        };
        try {
            await s3client.putObject(putObjectRequest).promise();
        } catch (err) {
            if (this.createIfBucketDoesntExist && err.code === 'NoSuchBucket') {
                const request: CreateBucketRequest = {
                    Bucket: this.bucketName,
                };

                if (this.region.toLocaleLowerCase() !== 'us-east-1') {
                    request.CreateBucketConfiguration = {
                         LocationConstraint: this.region,
                    };
                }
                await s3client.createBucket(request).promise();
                await s3client.putPublicAccessBlock( {Bucket: this.bucketName, PublicAccessBlockConfiguration: {
                                                                                    BlockPublicAcls: true,
                                                                                    IgnorePublicAcls: true,
                                                                                    BlockPublicPolicy: true,
                                                                                    RestrictPublicBuckets: true},
                                                                                }).promise();
                await s3client.putBucketEncryption({Bucket: this.bucketName, ServerSideEncryptionConfiguration: {
                    Rules: [{ApplyServerSideEncryptionByDefault: {SSEAlgorithm: 'AES256'} }],
                }}).promise();
                await s3client.putObject(putObjectRequest).promise();
            }
        }
    }
}

export class FileStorageProvider implements IStorageProvider {
    private readonly filePath: string;

    constructor(filePath: string) {
        this.filePath = filePath;
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
        writeFileSync(this.filePath, contents, {encoding: 'utf8'});
    }
}
