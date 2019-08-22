import { CloudFormation, STS } from 'aws-sdk/clients/all';
import { CreateStackInput, DeleteStackInput, UpdateStackInput } from 'aws-sdk/clients/cloudformation';
import { CredentialsOptions } from 'aws-sdk/lib/credentials';
import { PersistedState } from '../state/persisted-state';
import { ICfnBinding } from './cfn-binder';

export class CfnTaskProvider {
    private state: PersistedState;

    constructor(state: PersistedState) {
        this.state = state;
    }

    public createUpdateTemplateTask(binding: ICfnBinding, template: string, hash: string): ICfnTask[] {
        const that = this;
        return [{
            accountId: binding.accountId,
            region: binding.region,
            stackName: binding.stackName,
            action: 'UpdateOrCreate',
            perform: async () => {
                const cfn = await that.createCreateCloudFormationFn(binding);
                const stackInput: CreateStackInput | UpdateStackInput = {
                    StackName: binding.stackName,
                    TemplateBody: template,
                };
                try {
                    await cfn.updateStack(stackInput).promise();
                    await cfn.waitFor('stackUpdateComplete', { StackName: binding.stackName}).promise();
                } catch (err) {
                    if (err && err.code === 'ValidationError' && err.message) {
                        const message = err.message;
                        if (-1 !== (message as string).indexOf('ROLLBACK_COMPLETE')) {
                            await cfn.deleteStack({ StackName: binding.stackName}).promise();
                            await cfn.waitFor('stackDeleteComplete', { StackName: binding.stackName}).promise();
                            await cfn.createStack(stackInput).promise();
                            const response = await cfn.waitFor('stackCreateComplete', { StackName: binding.stackName}).promise();
                            console.log(response);
                        }
                    } else if (err && err.code === 'StackNotFoundException') {
                        await cfn.createStack(stackInput).promise();
                        await cfn.waitFor('stackCreateComplete', { StackName: binding.stackName}).promise();
                    } else {
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

    public createDeleteTemplateTask(binding: ICfnBinding): ICfnTask[] {
        const that = this;
        return [{
            accountId: binding.accountId,
            region: binding.region,
            stackName: binding.stackName,
            action: 'Delete',
            perform: async () => {
                const cfn = await that.createCreateCloudFormationFn(binding);
                const deleteStackInput: DeleteStackInput = {
                    StackName: binding.stackName,
                };
                await cfn.deleteStack(deleteStackInput).promise();
                await cfn.waitFor('stackDeleteComplete', { StackName: deleteStackInput.StackName}).promise();
                that.state.removeTarget(
                    binding.accountId,
                    binding.region,
                    binding.stackName);
            },
        }];
    }

    private async createCreateCloudFormationFn(binding: ICfnBinding): Promise<CloudFormation> {
        const sts = new STS();
        const roleArn = 'arn:aws:iam::' + binding.accountId + ':role/OrganizationAccountAccessRole';
        const response = await sts.assumeRole({RoleArn: roleArn, RoleSessionName: 'OrganizationFormationBuild' }).promise();

        const credentialOptions: CredentialsOptions = {
            accessKeyId: response.Credentials.AccessKeyId,
            secretAccessKey: response.Credentials.SecretAccessKey,
            sessionToken: response.Credentials.SessionToken,
        };

        return new CloudFormation({credentials: credentialOptions, region: binding.region});
    }

}

export interface ICfnTask {
    action: CfnBuildTaskAction;
    accountId: string;
    region: string;
    stackName: string;
    perform: (task: ICfnTask) => Promise<void>;

}
type CfnBuildTaskAction = 'UpdateOrCreate' | 'Delete';
