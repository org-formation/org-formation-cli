"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const all_1 = require("aws-sdk/clients/all");
class CfnTaskProvider {
    constructor(state) {
        this.state = state;
    }
    createUpdateTemplateTask(binding, template, hash) {
        const that = this;
        return [{
                accountId: binding.accountId,
                region: binding.region,
                stackName: binding.stackName,
                action: 'UpdateOrCreate',
                perform: async () => {
                    const cfn = await that.createCreateCloudFormationFn(binding);
                    const stackInput = {
                        StackName: binding.stackName,
                        TemplateBody: template,
                    };
                    try {
                        await cfn.updateStack(stackInput).promise();
                        await cfn.waitFor('stackUpdateComplete', { StackName: binding.stackName }).promise();
                    }
                    catch (err) {
                        if (err && err.code === 'ValidationError' && err.message) {
                            const message = err.message;
                            if (-1 !== message.indexOf('ROLLBACK_COMPLETE')) {
                                await cfn.deleteStack({ StackName: binding.stackName }).promise();
                                await cfn.waitFor('stackDeleteComplete', { StackName: binding.stackName }).promise();
                                await cfn.createStack(stackInput).promise();
                                const response = await cfn.waitFor('stackCreateComplete', { StackName: binding.stackName }).promise();
                                console.log(response);
                            }
                        }
                        else if (err && err.code === 'StackNotFoundException') {
                            await cfn.createStack(stackInput).promise();
                            await cfn.waitFor('stackCreateComplete', { StackName: binding.stackName }).promise();
                        }
                        else {
                            throw err;
                        }
                    }
                    that.state.setTarget({
                        accountId: binding.accountId,
                        region: binding.region,
                        stackName: binding.stackName,
                        lastCommittedHash: hash,
                        logicalAccountId: binding.template.accountLogicalId,
                    });
                },
            }];
    }
    createDeleteTemplateTask(binding) {
        const that = this;
        return [{
                accountId: binding.accountId,
                region: binding.region,
                stackName: binding.stackName,
                action: 'Delete',
                perform: async () => {
                    const cfn = await that.createCreateCloudFormationFn(binding);
                    const deleteStackInput = {
                        StackName: binding.stackName,
                    };
                    await cfn.deleteStack(deleteStackInput).promise();
                    await cfn.waitFor('stackDeleteComplete', { StackName: deleteStackInput.StackName }).promise();
                    that.state.removeTarget(binding.accountId, binding.region, binding.stackName);
                },
            }];
    }
    async createCreateCloudFormationFn(binding) {
        const sts = new all_1.STS();
        const roleArn = 'arn:aws:iam::' + binding.accountId + ':role/OrganizationAccountAccessRole';
        const response = await sts.assumeRole({ RoleArn: roleArn, RoleSessionName: 'OrganizationFormationBuild' }).promise();
        const credentialOptions = {
            accessKeyId: response.Credentials.AccessKeyId,
            secretAccessKey: response.Credentials.SecretAccessKey,
            sessionToken: response.Credentials.SessionToken,
        };
        return new all_1.CloudFormation({ credentials: credentialOptions, region: binding.region });
    }
}
exports.CfnTaskProvider = CfnTaskProvider;
//# sourceMappingURL=cfn-task-provider.js.map