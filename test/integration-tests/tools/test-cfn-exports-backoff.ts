import { CloudFormation } from "aws-sdk";
import { AwsUtil } from "~util/aws-util";

const stressExportsParallel = async () => {
  await Promise.all([stressExports(), stressExports(), stressExports(), stressExports(), stressExports(), stressExports()]);
};

const stressExports = async () => {
  await AwsUtil.GetCloudFormationExport("xxxxxxxx", "ccccccc", "eu-central-1", "");
  await AwsUtil.GetCloudFormationExport("xxxxxxxx", "ccccccc", "eu-central-1", "");
  await AwsUtil.GetCloudFormationExport("xxxxxxxx", "ccccccc", "eu-central-1", "");
  await AwsUtil.GetCloudFormationExport("xxxxxxxx", "ccccccc", "eu-central-1", "");
  await AwsUtil.GetCloudFormationExport("xxxxxxxx", "ccccccc", "eu-central-1", "");
  await AwsUtil.GetCloudFormationExport("xxxxxxxx", "ccccccc", "eu-central-1", "");
  await AwsUtil.GetCloudFormationExport("xxxxxxxx", "ccccccc", "eu-central-1", "");
  await AwsUtil.GetCloudFormationExport("xxxxxxxx", "ccccccc", "eu-central-1", "");
  await AwsUtil.GetCloudFormationExport("xxxxxxxx", "ccccccc", "eu-central-1", "");
  await AwsUtil.GetCloudFormationExport("xxxxxxxx", "ccccccc", "eu-central-1", "");
  await AwsUtil.GetCloudFormationExport("xxxxxxxx", "ccccccc", "eu-central-1", "");
  await AwsUtil.GetCloudFormationExport("xxxxxxxx", "ccccccc", "eu-central-1", "");
  await AwsUtil.GetCloudFormationExport("xxxxxxxx", "ccccccc", "eu-central-1", "");
  await AwsUtil.GetCloudFormationExport("xxxxxxxx", "ccccccc", "eu-central-1", "");
}

AwsUtil.GetCloudFormation = () => { return Promise.resolve(new CloudFormation({ region: "eu-central-1" })); }
stressExportsParallel().then(x => console.log("done"));
