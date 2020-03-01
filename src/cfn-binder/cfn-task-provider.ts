import { CreateStackInput, DeleteStackInput, ListExportsInput, UpdateStackInput } from 'aws-sdk/clients/cloudformation';
import uuid = require('uuid');
import { AwsUtil } from '../aws-util';
import { ConsoleUtil } from '../console-util';
import { ICfnBinding } from './cfn-binder';
import { PersistedState } from '~state/persisted-state';
export class CfnTaskProvider {
    private state: PersistedState;

    constructor(state: PersistedState) {
        this.state = state;
    }

    public createUpdateTemplateTask(binding: ICfnBinding): ICfnTask {
        const that = this;
        const dependencies: ICrossAccountParameterDependency[] = [];
        const boundParameters = binding.template.enumBoundParameters();
        for (const paramName in boundParameters) {
            const param = boundParameters[paramName];
            const dependency: ICrossAccountParameterDependency = {
                ExportAcountId: binding.accountId,
                ExportRegion: binding.region,
                ExportName: param.ExportName,
                ParameterKey: paramName,
            };
            if (param.ExportAccountId) { dependency.ExportAcountId = param.ExportAccountId; }
            if (param.ExportRegion) { dependency.ExportRegion = param.ExportRegion; }
            dependencies.push(dependency);

            delete param.ExportAccountId;
            delete param.ExportName;
            delete param.ExportRegion;
        }

        return {
            accountId: binding.accountId,
            region: binding.region,
            stackName: binding.stackName,
            action: 'UpdateOrCreate',
            isDependency: (): boolean => false,
            perform: async (): Promise<void> => {

                const templateBody = binding.template.createTemplateBody();
                const cfn = await AwsUtil.GetCloudFormation(binding.accountId, binding.region);
                const clientToken = uuid();
                const stackInput: CreateStackInput | UpdateStackInput = {
                    StackName: binding.stackName,
                    TemplateBody: templateBody,
                    Capabilities: ['CAPABILITY_NAMED_IAM', 'CAPABILITY_IAM'],
                    ClientRequestToken: clientToken,
                    Parameters: [],
                };

                for (const dependency of dependencies) {
                    const cfnRetrieveExport = await AwsUtil.GetCloudFormation(dependency.ExportAcountId, dependency.ExportRegion);
                    const listExportsRequest: ListExportsInput = {};
                    const listExportsResponse = await cfnRetrieveExport.listExports(listExportsRequest).promise();
                    let didFindExport = false;
                    do {
                        listExportsRequest.NextToken = listExportsResponse.NextToken;
                        const foundExport = listExportsResponse.Exports.find(x => x.Name === dependency.ExportName);
                        if (foundExport) {
                            stackInput.Parameters.push( {
                                ParameterKey: dependency.ParameterKey,
                                ParameterValue: foundExport.Value,
                            });
                            didFindExport = true;
                            break;
                        }
                    } while (listExportsRequest.NextToken);

                    if (!didFindExport) {
                        // this is somewhat lame, but is here to support cross account references where the dependency has a condition.
                        // the depdendency and dependee both have conditions
                        // the generated export has a condition
                        // the parameter used in the template of dependee cannot have a condition.
                        //  so we use an empty valu instead :(
                        stackInput.Parameters.push( {
                            ParameterKey: dependency.ParameterKey,
                            ParameterValue: '',
                        });
                    }
                }

                if (binding.parameters) {
                    for (const [key, value] of Object.entries(binding.parameters)) {
                        stackInput.Parameters.push( {
                            ParameterKey: key,
                            ParameterValue: value,
                        });
                    }
                }
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

                    if (binding.state === undefined && binding.terminationProtection === true) {
                        await cfn.updateTerminationProtection({StackName: binding.stackName, EnableTerminationProtection: true}).promise();
                    } else if (binding.state !== undefined) {
                        if (binding.terminationProtection) {
                            if (!binding.state.terminationProtection) {
                                await cfn.updateTerminationProtection({StackName: binding.stackName, EnableTerminationProtection: true}).promise();
                            }
                        } else {
                            if (binding.state.terminationProtection) {
                                await cfn.updateTerminationProtection({StackName: binding.stackName, EnableTerminationProtection: false}).promise();
                            }
                        }
                    }

                    that.state.setTarget({
                        accountId: binding.accountId,
                        region: binding.region,
                        stackName: binding.stackName,
                        lastCommittedHash: binding.templateHash,
                        logicalAccountId: binding.target.accountLogicalId,
                        terminationProtection: binding.terminationProtection,
                    });
                } catch (err) {
                    ConsoleUtil.LogError(`error updating cloudformation stack ${binding.stackName} in account ${binding.accountId} (${binding.region}). \n${err.message}`);
                    try {
                        const stackEvents = await cfn.describeStackEvents({ StackName: binding.stackName }).promise();
                        for (const event of stackEvents.StackEvents) {
                            const failureStates = ['CREATE_FAILED', 'DELETE_FAILED', 'UPDATE_FAILED'];
                            if (event.ClientRequestToken === clientToken) {
                                if (failureStates.indexOf(event.ResourceStatus) >= 0) {
                                    ConsoleUtil.LogError(`Resource ${event.LogicalResourceId} failed because ${event.ResourceStatusReason}.`);

                                    if (/[0-9a-f]*\|[0-9]{12} already exists in stack /.test(event.ResourceStatusReason)) {
                                        ConsoleUtil.LogError('!!! It seems like you got this error when updating guardduty resources.');
                                        ConsoleUtil.LogError('!!! Possibly your first change to guardduty since upgrading to org-formation to 0.0.70+ or you renamed a logical account id.');
                                        ConsoleUtil.LogError('!!! You can resolve this error by commenting out both Master and Member resources and updating the stack');
                                        ConsoleUtil.LogError('!!! After updating the stacks without these resources uncomment first the Member resource them back, run update, then also the Master resource.');
                                        ConsoleUtil.LogError('!!! hopefully that will fix this. Sorry for the inconveniance!! <3 from org-formation.');

                                    }
                                }
                            }
                        }
                    } catch {/* hide*/ }

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
            isDependency: (): boolean => false,
            action: 'Delete',
            perform: async (): Promise<void> => {
                try {
                    const cfn = await AwsUtil.GetCloudFormation(binding.accountId, binding.region);
                    const deleteStackInput: DeleteStackInput = {
                        StackName: binding.stackName,
                    };
                    await cfn.deleteStack(deleteStackInput).promise();
                    await cfn.waitFor('stackDeleteComplete', { StackName: deleteStackInput.StackName, $waiter: { delay: 1, maxAttempts: 60 * 30 } }).promise();
                } catch (err) {
                    ConsoleUtil.LogInfo(`unable to delete stack ${binding.stackName} from ${binding.accountId} / ${binding.region}. Removing stack from state instead.`);
                }
                that.state.removeTarget(
                    binding.stackName,
                    binding.accountId,
                    binding.region);
            },
        };
    }

}

interface ICrossAccountParameterDependency {
    ExportAcountId: string;
    ExportRegion: string;
    ExportName: string;
    ParameterKey: string;
}

export interface ICfnTask {
    action: CfnBuildTaskAction;
    accountId: string;
    region: string;
    stackName: string;
    perform: () => Promise<void>;
    isDependency: (task: ICfnTask) => boolean;

}
type CfnBuildTaskAction = 'UpdateOrCreate' | 'Delete' | 'Validate';
