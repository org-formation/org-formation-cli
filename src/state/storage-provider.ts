import { S3, STS } from 'aws-sdk';
import { CreateBucketRequest, GetObjectRequest, PutObjectRequest } from 'aws-sdk/clients/s3';
import { readFileSync, writeFileSync } from 'fs';

export interface IStorageProvider {
    get(): Promise<string>;
    put(contents: string): Promise<void>;
}

export class S3StorageProvider implements IStorageProvider {

    public static async Create(bucketName: string, objectKey: string, createIfBucketDoesntExist: boolean = false): Promise<S3StorageProvider> {
        let processedBucketName = bucketName;
        if (bucketName.indexOf('${AWS::AccountId}') >= 0) {
            const accountId = await S3StorageProvider.getCurrentAccountId();
            processedBucketName = bucketName.replace('${AWS::AccountId}', accountId );
        }

        return new S3StorageProvider(processedBucketName, objectKey, createIfBucketDoesntExist);
    }

    private static async getCurrentAccountId(): Promise<string> {
        const stsClient = new STS();
        const caller = await stsClient.getCallerIdentity().promise();
        return caller.Account;
    }

    private readonly bucketName: string;
    private readonly objectKey: string;
    private readonly createIfBucketDoesntExist: boolean;

    private constructor(stateBucketName: string, stateObject: string, createIfBucketDoesntExist: boolean = false) {
        this.bucketName = stateBucketName;
        this.objectKey = stateObject;
        this.createIfBucketDoesntExist = createIfBucketDoesntExist;
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
            console.log(err);
            throw err;
        }
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
                await s3client.createBucket(request).promise();
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
