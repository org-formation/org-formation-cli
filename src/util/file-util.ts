import { readFileSync } from 'fs';
import fetch from 'node-fetch';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { AwsUtil } from './aws-util';
import { OrgFormationError } from '~org-formation-error';

export class FileUtil {

    static IsS3Object(filePath: string): boolean {
        return filePath.toLowerCase().startsWith('s3://');
    }

    static IsHTTPObject(filePath: string): boolean {
        return filePath.toLowerCase().startsWith('https://');
    }

    static IsRemoteFile(filePath: string): boolean {
        return this.IsS3Object(filePath) || this.IsHTTPObject(filePath);
    }

    static async GetContents(filePath: string): Promise<string> {
        if (filePath === undefined) {throw new Error('FileUtil.GetContents filePath is undefined');}

        if (this.IsS3Object(filePath)) {
            try{
                const buildAccountId = await AwsUtil.GetBuildProcessAccountId();
                const s3client = AwsUtil.GetS3Service(buildAccountId, undefined);

                const bucketAndKey = filePath.substring(5);
                const bucketAndKeySplit = bucketAndKey.split('/');
                const bucket = bucketAndKeySplit[0];
                bucketAndKeySplit.splice(0,1);
                const key =  bucketAndKeySplit.join('/');
                const response = await s3client.send(new GetObjectCommand({ Bucket:bucket, Key: key}));
                return await response.Body.transformToString('utf-8');
            }catch(err) {
                throw new OrgFormationError(`unable to get contents of S3 hosted file (path: ${filePath}), error: ${err.message}`);
            }
        } else  if (this.IsHTTPObject(filePath)) {
            try{
                const response = await fetch(filePath);
                if (response.status >= 200 && response.status < 300) {
                    return await response.text();
                } else  {
                    throw new Error(`unexpected status code: ${response.status}, ${response.statusText}`);
                }
            }catch(err) {
                throw new OrgFormationError(`unable to get contents of file (url: ${filePath}), error: ${err.message}`);
            }

        } else {
            return readFileSync(filePath).toString();
        }
    }
}
