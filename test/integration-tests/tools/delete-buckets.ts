import { S3, SharedIniFileCredentials } from "aws-sdk";

const bucketsToDelete = /(\{){0,1}[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}(\}){0,1}/;
const credentials = new SharedIniFileCredentials({profile: 'org-formation-test'});

deleteBuckets().then(x=>console.log('done'));

async function deleteBuckets(): Promise<void> {
    const s3 = new S3({credentials});
    const bucketList = await s3.listBuckets().promise();
    for(const bucket of bucketList.Buckets) {
        if (bucketsToDelete.test(bucket.Name)) {
            console.log(`deleting ${bucket.Name}`);
            const objectList = await s3.listObjects({Bucket: bucket.Name}).promise();
            for(const obj of objectList.Contents) {
                await s3.deleteObject({Bucket: bucket.Name, Key: obj.Key}).promise();
            }
            await s3.deleteBucket({Bucket: bucket.Name}).promise();
        }
    }
}