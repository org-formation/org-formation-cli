import { DeleteBucketCommand, DeleteObjectCommand, ListBucketsCommand, ListObjectVersionsCommand, ListObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-providers';

const bucketsToDelete = /(\{){0,1}[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}(\}){0,1}/;

const deleteBuckets = async (): Promise<void> => {
    const s3 = new S3Client({ credentials: fromIni({ profile: 'org-formation-test-v2' }), region: "eu-west-1" });
    const bucketList = await s3.send(new ListBucketsCommand({}));
    for (const bucket of bucketList.Buckets) {

        if (bucketsToDelete.test(bucket.Name)) {
            console.log(`deleting ${bucket.Name}`);
            try {
                const objectVersionList = await s3.send(new ListObjectVersionsCommand({ Bucket: bucket.Name }));
                for (const obj of (objectVersionList.Versions || [])) {
                    await s3.send(new DeleteObjectCommand({ Bucket: bucket.Name, Key: obj.Key, VersionId: obj.VersionId }));
                }
                for (const obj of (objectVersionList.DeleteMarkers || [])) {
                    await s3.send(new DeleteObjectCommand({ Bucket: bucket.Name, Key: obj.Key, VersionId: obj.VersionId }));
                }
                await s3.send(new DeleteBucketCommand({ Bucket: bucket.Name }));
            } catch (err) {
                console.log(`failed deleting bucket ${bucket.Name}`, err);
            }
        }
    }
};

deleteBuckets().then(x => console.log('done'));
