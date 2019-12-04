import { CloudFormation, STS } from 'aws-sdk/clients/all';
import { CreateStackInput, DeleteStackInput, ListExportsInput, UpdateStackInput } from 'aws-sdk/clients/cloudformation';
import { CredentialsOptions } from 'aws-sdk/lib/credentials';
import md5 = require('md5');
import uuid = require('uuid');
import { ConsoleUtil } from '../console-util';
import { PersistedState } from '../state/persisted-state';
import { ICfnBinding } from './cfn-binder';

export class CfnTaskProvider {
    private state: PersistedState;

    constructor(state: PersistedState) {
        this.state = state;
    }

    public createUpdateTemplateTask(binding: ICfnBinding): ICfnTask {
        const that = this;
        return {
            accountId: binding.accountId,
            region: binding.region,
            stackName: binding.stackName,
            action: 'UpdateOrCreate',
            perform: async () => {
                 const boundParameters = binding.template.enumBoundParameters();
                 for (const param of boundParameters) {
                    const site: ICfnSite = {accountId: binding.accountId, region: binding.region};
                    if (param.ExportAccountId) { site.accountId = param.ExportAccountId; }
                    if (param.ExportRegion) {site.region = param.ExportRegion; }
                    const cfnRetrieveExport = await that.createCreateCloudFormationFn(site);
                    const listExportsRequest: ListExportsInput = {};
                    const listExportsResponse = await cfnRetrieveExport.listExports(listExportsRequest).promise();
                    do {
                        listExportsRequest.NextToken = listExportsResponse.NextToken;
                        const foundExport = listExportsResponse.Exports.find((x) => x.Name === param.ExportName);
                        if (foundExport) {
                            param.Default = foundExport.Value;
                            delete param.ExportAccountId;
                            delete param.ExportRegion;
                            delete param.ExportName;
                            break;
                        }
                    } while (listExportsRequest.NextToken);
                 }
                 const templateBody = binding.template.createTemplateBody();
                 const cfn = await that.createCreateCloudFormationFn(binding);
                 const clientToken = uuid();
                 const stackInput: CreateStackInput | UpdateStackInput = {
                    StackName: binding.stackName,
                    TemplateBody: templateBody,
                    Capabilities: ['CAPABILITY_NAMED_IAM', 'CAPABILITY_IAM'],
                    ClientRequestToken: clientToken,
                };
                 try {
                    try {
                        await cfn.updateStack(stackInput).promise();
                        await cfn.waitFor('stackUpdateComplete', { StackName: binding.stackName, $waiter: { delay: 1, maxAttempts: 60 * 30 } }).promise();
                    } catch (err) {
                        if (err && err.code === 'ValidationError' && err.message) {
                            const message = err.message as string;
                            if (-1 !== message.indexOf('ROLLBACK_COMPLETE')) {
                                await cfn.deleteStack({ StackName: binding.stackName }).promise();
                                await cfn.waitFor('stackDeleteComplete', { StackName: binding.stackName, $waiter: { delay: 1 } }).promise();
                                await cfn.createStack(stackInput).promise();
                                await cfn.waitFor('stackCreateComplete', { StackName: binding.stackName, $waiter: { delay: 1, maxAttempts: 60 * 30 } }).promise();
                            } else if (-1 !== message.indexOf('does not exist')) {
                                await cfn.createStack(stackInput).promise();
                                await cfn.waitFor('stackCreateComplete', { StackName: binding.stackName, $waiter: { delay: 1, maxAttempts: 60 * 30 } }).promise();
                            } else if (-1 !== message.indexOf('No updates are to be performed.')) {
                                // ignore;
                            } else if (err.code === 'ResourceNotReady') {
                                ConsoleUtil.LogError('error when executing cloudformation');
                            } else {
                                throw err;
                            }
                        } else {
                            throw err;
                        }
                    }

                    that.state.setTarget({
                        accountId: binding.accountId,
                        region: binding.region,
                        stackName: binding.stackName,
                        lastCommittedHash: binding.templateHash,
                        logicalAccountId: binding.target.accountLogicalId,
                    });
                } catch (err) {
                    ConsoleUtil.LogError(`error updating cloudformation stack ${binding.stackName} in account ${binding.accountId} (${binding.region}). \n${err.message}`);
                    try {
                        const stackEvents = await cfn.describeStackEvents({StackName: binding.stackName }).promise();
                        for (const event of stackEvents.StackEvents) {
                            const failureStates = ['CREATE_FAILED', 'DELETE_FAILED', 'UPDATE_FAILED'];
                            if (event.ClientRequestToken === clientToken) {
                                if (failureStates.indexOf(event.ResourceStatus) >= 0) {
                                    ConsoleUtil.LogError(`Resource ${event.LogicalResourceId} failed because ${event.ResourceStatusReason}.`);
                                }
                            }
                        }
                    } catch {/*hide*/}

                    throw err;
                }
            },
        };
    }

    public createDeleteTemplateTask(binding: ICfnBinding): ICfnTask {
        const that = this;
        return {
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
                await cfn.waitFor('stackDeleteComplete', { StackName: deleteStackInput.StackName, $waiter: { delay: 1, maxAttempts: 60 * 30 } }).promise();
                that.state.removeTarget(
                    binding.stackName,
                    binding.accountId,
                    binding.region);
            },
        };
    }

    private async createCreateCloudFormationFn(site: ICfnSite): Promise<CloudFormation> {
        if (site.accountId !== this.state.masterAccount) {
            const sts = new STS();
            const roleArn = 'arn:aws:iam::' + site.accountId + ':role/OrganizationAccountAccessRole';
            const response = await sts.assumeRole({ RoleArn: roleArn, RoleSessionName: 'OrganizationFormationBuild' }).promise();

            const credentialOptions: CredentialsOptions = {
                accessKeyId: response.Credentials.AccessKeyId,
                secretAccessKey: response.Credentials.SecretAccessKey,
                sessionToken: response.Credentials.SessionToken,
            };

            return new CloudFormation({ credentials: credentialOptions, region: site.region });
        } else {
            return new CloudFormation({ region: site.region });
        }

    }

}

interface ICfnSite {
    accountId: string;
    region: string;
}

export interface ICfnTask {
    action: CfnBuildTaskAction;
    accountId: string;
    region: string;
    stackName: string;
    perform: (task: ICfnTask) => Promise<void>;
    dependentTaskFilter?: (task: ICfnTask) => boolean;

}
type CfnBuildTaskAction = 'UpdateOrCreate' | 'Delete';
