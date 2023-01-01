import { S3, SharedIniFileCredentials, Organizations, STS } from "aws-sdk";
import * as AWS from "aws-sdk";

const bucketsToDelete = /(\{){0,1}[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}(\}){0,1}/;
let credentials = new SharedIniFileCredentials({ profile: 'org-formation-test-v2' });
const sts = new STS({ credentials });
AWS.config.logger = console;
sts.assumeRole({ RoleArn: "arn:aws:iam::340381375986:role/OrganizationAccountAccessRole", RoleSessionName: "deletebuckets" }).promise().then(x => {
    credentials.accessKeyId = x.Credentials.AccessKeyId;
    credentials.secretAccessKey = x.Credentials.SecretAccessKey;
    credentials.sessionToken = x.Credentials.SessionToken;
    deleteBuckets().then(x => console.log('done'));
});
//stressOrganization().then(x=>console.log('done'));

async function deleteBuckets(): Promise<void> {
    const s3 = new S3({ credentials });
    const bucketList = await s3.listBuckets().promise();
    for (const bucket of bucketList.Buckets) {
        if (
            // bucket.Name?.startsWith('serverlessrepo-org-forma') ||
            // bucket.Name?.startsWith('cloudformationmanageduploadinfrast-artifactbucket') ||
            // bucket.Name?.startsWith('cf-templates') //||
            bucketsToDelete.test(bucket.Name)) {
            try {
                console.log(`deleting ${bucket.Name}`);
                const objectList = await s3.listObjects({ Bucket: bucket.Name }).promise();
                for (const obj of objectList.Contents) {
                    await s3.deleteObject({ Bucket: bucket.Name, Key: obj.Key }).promise();
                }
                await s3.deleteBucket({ Bucket: bucket.Name }).promise();
            } catch { }
        }
    }
}

async function stressOrganization(): Promise<void> {
    const org = new Organizations({ credentials, region: 'us-east-1' });
    let i = 0;
    while (i < 5) {
        org.updateOrganizationalUnit({ OrganizationalUnitId: 'ou-kvte-6olfshzg', Name: 'test' + i }).promise().catch(err => {
            console.log(err);
        });
        i++;
    }
}

