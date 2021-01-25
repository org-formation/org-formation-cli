import { readFileSync } from 'fs';
import { S3 } from 'aws-sdk';

export class FileUtil {

    static async GetContents(filePath: string): Promise<string> {
        if (filePath === undefined) {throw new Error('FileUtil.GetContents filePath is undefined');}

        if (filePath.startsWith('s3://')) {
            const s3client = new S3(); // todo: fix this
            const bucketAndKey = filePath.substring(5);
            const bucketAndKeySplit = bucketAndKey.split('/');
            const response = await s3client.getObject({ Bucket: bucketAndKeySplit[0], Key: bucketAndKeySplit[1] }).promise();
            return response.Body.toString();
        } else {
            return readFileSync(filePath).toString();
        }
    }
}
