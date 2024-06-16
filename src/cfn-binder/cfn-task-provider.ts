import { CreateStackCommandInput, DeleteStackCommand, DeleteStackCommandInput, DescribeStackEventsCommand, Tag, UpdateStackCommandInput, UpdateTerminationProtectionCommand, waitUntilStackDeleteComplete } from '@aws-sdk/client-cloudformation';
import { AwsUtil, CfnUtil } from '../util/aws-util';
import { ConsoleUtil } from '../util/console-util';
import { OrgFormationError } from '../../src/org-formation-error';
import { ICfnBinding } from './cfn-binder';
import { PersistedState } from '~state/persisted-state';
import { ICfnExpression } from '~core/cfn-expression';
import { CfnExpressionResolver } from '~core/cfn-expression-resolver';
import { TemplateRoot } from '~parser/parser';

export class CfnTaskProvider {
    constructor(private readonly template: TemplateRoot, private readonly state: PersistedState, private readonly logVerbose: boolean) {

    }

    public async createUpdateTemplateTask(binding: ICfnBinding, parentResolver?: CfnExpressionResolver): Promise<ICfnTask> {
        const that = this;
        const dependencies: ICrossAccountParameterDependency[] = [];
        const boundParameters = binding.template.enumBoundParameters();
        for (const paramName in boundParameters) {
            const param = boundParameters[paramName];
            const dependency: ICrossAccountParameterDependency = {
                ExportAccountId: binding.accountId,
                ExportRegion: binding.region,
                ExportName: param.ExportName,
                ParameterKey: paramName,
            };
            if (param.ExportAccountId) { dependency.ExportAccountId = param.ExportAccountId; }
            if (param.ExportRegion) { dependency.ExportRegion = param.ExportRegion; }
            dependencies.push(dependency);

            delete param.ExportAccountId;
            delete param.ExportName;
            delete param.ExportRegion;
        }

        const parameters: Record<string, ICfnExpression> = {};
        for (const [paramName, paramValue] of Object.entries(binding.parameters)) {
            parameters[paramName] = paramValue;
        }

        const expressionResolver = CfnExpressionResolver.CreateDefaultResolver(binding.accountLogicalId, binding.accountId, binding.region, binding.customRoleName, binding.customViaRoleArn, this.template.organizationSection, this.state, true);
        if (parentResolver !== undefined) {
            expressionResolver.mapping = parentResolver.mapping;
            expressionResolver.filePath = parentResolver.filePath;
        }
        const stackName = await expressionResolver.resolveSingleExpression(binding.stackName, 'StackName');

        return {
            accountId: binding.accountId,
            region: binding.region,
            stackName,
            action: 'UpdateOrCreate',
            isDependency: (): boolean => false,
            perform: async (): Promise<void> => {

                const customRoleName = await expressionResolver.resolveSingleExpression(binding.customRoleName, 'CustomRoleName');
                const cloudFormationRoleName = await expressionResolver.resolveSingleExpression(binding.cloudFormationRoleName, 'CloudFormationRoleName');
                const customViaRoleArn = await expressionResolver.resolveSingleExpression(binding.customViaRoleArn, 'CustomViaRoleArn');

                const templateBody = await binding.template.createTemplateBodyAndResolve(expressionResolver);
                const cfn = AwsUtil.GetCloudFormationService(binding.accountId, binding.region, customRoleName, customViaRoleArn);

                let roleArn: string;
                if (cloudFormationRoleName) {
                    roleArn = AwsUtil.GetRoleArn(binding.accountId, cloudFormationRoleName);
                }
                const stackInput: CreateStackCommandInput | UpdateStackCommandInput = {
                    StackName: stackName,
                    TemplateBody: templateBody,
                    Capabilities: ['CAPABILITY_NAMED_IAM', 'CAPABILITY_IAM', 'CAPABILITY_AUTO_EXPAND'],
                    RoleARN: roleArn,
                    Parameters: [],
                };

                await CfnUtil.UploadTemplateToS3IfTooLarge(stackInput, binding, stackName, this.template.hash);

                if (binding.stackPolicy !== undefined) {
                    stackInput.StackPolicyBody = JSON.stringify(binding.stackPolicy);
                }

                const entries = Object.entries(binding.tags ?? {});
                stackInput.Tags = entries.map(x => ({ Key: x[0], Value: x[1] } as Tag));
                stackInput.DisableRollback = !!binding.disableStackRollbacks;
                for (const dependency of dependencies) {

                    const foundExport = await AwsUtil.GetCloudFormationExport(dependency.ExportName, dependency.ExportAccountId, dependency.ExportRegion, customRoleName, customViaRoleArn);

                    if (foundExport !== undefined) {
                        stackInput.Parameters.push({
                            ParameterKey: dependency.ParameterKey,
                            ParameterValue: foundExport,
                        });
                    } else {
                        // this is somewhat lame, but is here to support cross account references where the dependency has a condition.
                        // the dependency and dependent both have conditions
                        // the generated export has a condition
                        // the parameter used in the template of dependent cannot have a condition.
                        //  so we use an empty value instead :(
                        stackInput.Parameters.push({
                            ParameterKey: dependency.ParameterKey,
                            ParameterValue: '',
                        });
                    }
                }

                if (parameters) {

                    for (const [key, value] of Object.entries(parameters)) {

                        let paramValue = value;
                        if (typeof paramValue === 'object') {
                            paramValue = await expressionResolver.resolve(paramValue);
                            paramValue = await expressionResolver.collapse(paramValue);
                        }

                        if (typeof paramValue === 'object') {
                            if (Array.isArray(paramValue)) {
                                paramValue = paramValue.join(', ');
                            } else {
                                throw new OrgFormationError(`unable to fully resolve expression ${JSON.stringify(paramValue)}`);
                            }
                        } else if (typeof paramValue === 'undefined') {
                            paramValue = '';
                        }

                        stackInput.Parameters.push({
                            ParameterKey: key,
                            ParameterValue: '' + paramValue as string,
                        });
                    }
                }
                try {
                    await CfnUtil.UpdateOrCreateStack(cfn, stackInput);
                    if (binding.state === undefined && binding.terminationProtection === true) {
                        ConsoleUtil.LogDebug(`Enabling termination protection for stack ${stackName}`, this.logVerbose);
                        await cfn.send(
                            new UpdateTerminationProtectionCommand({ StackName: stackName, EnableTerminationProtection: true })
                        );
                    } else if (binding.state !== undefined) {
                        if (binding.terminationProtection) {
                            if (!binding.state.terminationProtection) {
                                ConsoleUtil.LogDebug(`Enabling termination protection for stack ${stackName}`, this.logVerbose);
                                await cfn.send(
                                    new UpdateTerminationProtectionCommand({ StackName: stackName, EnableTerminationProtection: true })
                                );
                            }
                        } else {
                            if (binding.state.terminationProtection) {
                                ConsoleUtil.LogDebug(`Disabling termination protection for stack ${stackName}`, this.logVerbose);
                                await cfn.send(
                                    new UpdateTerminationProtectionCommand({ StackName: stackName, EnableTerminationProtection: false })
                                );
                            }
                        }
                    }

                    that.state.setTarget({
                        accountId: binding.accountId,
                        region: binding.region,
                        stackName,
                        lastCommittedHash: binding.templateHash,
                        logicalAccountId: binding.target.accountLogicalId,
                        terminationProtection: binding.terminationProtection,
                        cloudFormationRoleName: binding.cloudFormationRoleName,
                        customRoleName: binding.customRoleName,
                        customViaRoleArn: binding.customViaRoleArn,
                    });
                } catch (err) {
                    if (err.name !== 'OptInRequired') {
                        ConsoleUtil.LogError(`error updating CloudFormation stack ${stackName} in account ${binding.accountId} (${binding.region}). \n${err.message}`);
                    }
                    try {
                        const stackEvents = await cfn.send(new DescribeStackEventsCommand({ StackName: stackName }));
                        for (const event of stackEvents.StackEvents) {
                            const failureStates = ['CREATE_FAILED', 'DELETE_FAILED', 'UPDATE_FAILED'];
                            if (event.ClientRequestToken === stackInput.ClientRequestToken) {
                                if (failureStates.indexOf(event.ResourceStatus) >= 0) {
                                    ConsoleUtil.LogError(`Resource ${event.LogicalResourceId} failed because ${event.ResourceStatusReason}.`);

                                    if (/[0-9a-f]*\|[0-9]{12} already exists in stack /.test(event.ResourceStatusReason)) {
                                        ConsoleUtil.LogError('!!! It seems like you got this error when updating GuardDuty resources.');
                                        ConsoleUtil.LogError('!!! Possibly your first change to GuardDuty since upgrading to org-formation to 0.0.70+ or you renamed a logical account id.');
                                        ConsoleUtil.LogError('!!! You can resolve this error by commenting out both Master and Member resources and updating the stack');
                                        ConsoleUtil.LogError('!!! After updating the stacks without these resources uncomment first the Member resource them back, run update, then also the Master resource.');
                                        ConsoleUtil.LogError('!!! hopefully that will fix this. Sorry for the inconvenience!! <3 from org-formation.');
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

    public async createDeleteTemplateTask(binding: ICfnBinding, parentResolver?: CfnExpressionResolver): Promise<ICfnTask> {
        const that = this;

        const expressionResolver = CfnExpressionResolver.CreateDefaultResolver(binding.accountLogicalId, binding.accountId, binding.region, binding.customRoleName, binding.customViaRoleArn, this.template.organizationSection, this.state, true);
        if (parentResolver !== undefined) {
            expressionResolver.mapping = parentResolver.mapping;
            expressionResolver.filePath = parentResolver.filePath;
        }
        const stackName = await expressionResolver.resolveSingleExpression(binding.stackName, 'StackName');

        return {
            accountId: binding.accountId,
            region: binding.region,
            stackName,
            isDependency: (): boolean => false,
            action: 'Delete',
            perform: async (): Promise<void> => {

                const customRoleName = await expressionResolver.resolveSingleExpression(binding.customRoleName, 'CustomRoleName');
                const customViaRoleArn = await expressionResolver.resolveSingleExpression(binding.customViaRoleArn, 'CustomViaRoleArn');
                const cloudFormationRoleName = await expressionResolver.resolveSingleExpression(binding.cloudFormationRoleName, 'CloudFormationRoleName');

                try {
                    const cfn = AwsUtil.GetCloudFormationService(binding.accountId, binding.region, customRoleName, customViaRoleArn);

                    await performAndRetryIfNeeded(async () => {
                        let roleArn: string;
                        if (cloudFormationRoleName) {
                            roleArn = AwsUtil.GetRoleArn(binding.accountId, cloudFormationRoleName);
                        }

                        const deleteStackInput: DeleteStackCommandInput = {
                            StackName: stackName,
                            RoleARN: roleArn,
                        };
                        await cfn.send(new DeleteStackCommand(deleteStackInput));

                        await waitUntilStackDeleteComplete({
                            client: cfn,
                            maxDelay: 1,
                            maxWaitTime: 60 * 30,
                            minDelay: 1,
                        }, {
                            NextToken: undefined,
                            StackName: stackName,
                        });
                    });
                } catch (err) {
                    const message = err.message as string;
                    if (-1 !== message.indexOf('cannot be deleted while TerminationProtection is enabled')) {
                        throw err;
                    }
                    ConsoleUtil.LogError(`unable to delete stack ${stackName} from ${binding.accountId} / ${binding.region}. Removing stack from state instead. \n${err.message}`, err);
                }

                that.state.removeTarget(
                    stackName,
                    binding.accountId,
                    binding.region);
            },
        };
    }

}

export const performAndRetryIfNeeded = async <T extends unknown>(fn: () => Promise<T>): Promise<T> => {
    let shouldRetry = false;
    let retryCount = 0;
    do {
        shouldRetry = false;
        try {
            return await fn();
        } catch (err) {
            if (err && (err.name === 'ThrottlingException') && retryCount < 10) {
                retryCount = retryCount + 1;
                shouldRetry = true;
                const wait = retryCount + (0.5 * Math.random());
                ConsoleUtil.LogDebug(`received retryable error ${err.name}. wait ${wait} and retry-count ${retryCount}`);
                await sleep(wait * 1000);
                continue;
            }
            throw err;
        }
    }
    while (shouldRetry);
};

export const sleep = (time: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, time));
};

interface ICrossAccountParameterDependency {
    ExportAccountId: string;
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
    skip?: boolean;
}
type CfnBuildTaskAction = 'UpdateOrCreate' | 'Delete' | 'Validate';
