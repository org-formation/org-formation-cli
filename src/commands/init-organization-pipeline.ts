import archiver = require('archiver');
import { CloudFormation, S3 } from 'aws-sdk';
import { CreateStackInput, UpdateStackInput } from 'aws-sdk/clients/cloudformation';
import { PutObjectRequest } from 'aws-sdk/clients/s3';
import { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import { WritableStream } from 'memory-streams';
import { AwsUtil } from '../aws-util';
import { ConsoleUtil } from '../console-util';
import { OrgFormationError } from '../org-formation-error';
import { BaseCliCommand, ICommandArgs } from './base-command';

const commandName = 'init-pipeline';
const commandDescription = 'initializes organization and created codecommit repo, codebuild and codepipeline';

export class InitPipelineCommand extends BaseCliCommand<IInitPipelineCommandArgs> {

    constructor(command: Command) {
        super(command, commandName, commandDescription);
    }

    public addOptions(command: Command) {
        command.option('--region <region>', 'region used to created state-bucket and pipeline in');
        command.option('--stack-name <stack-name>', 'stack name used to create pipeline artifacts', 'organization-formation-build');
        command.option('--resource-prefix <resource-prefix>', 'name prefix used when creating AWS resources', 'orgformation-');
        command.option('--repository-name <repository-name>', 'name of the code commit repository created', 'organization-formation');

        super.addOptions(command);
    }

    public async performCommand(command: IInitPipelineCommandArgs) {
        if (!command.region) {
            throw new OrgFormationError(`argument --region is missing`);
        }

        const region = command.region;

        const resourcePrefix = command.resourcePrefix;
        const stackName = command.stackName;
        const storageProvider = await this.createOrGetStateBucket(command, region);

        const stateBucketName = storageProvider.bucketName;
        const codePipelineTemplateFileName = 'orgformation-codepipeline.yml';
        let path = __dirname + '/../../../resources/';
        if (!existsSync(path + codePipelineTemplateFileName)) {
            path = __dirname + '/../../resources/';
        }
        const template = await this.generateDefaultTemplate();
        const buildSpecContents = this.createBuildSpecContents(path, command, stateBucketName);

        ConsoleUtil.LogInfo(`uploading initial commit to S3 ${stateBucketName}/initial-commit.zip...`);
        await this.uploadInitialCommit(stateBucketName, path + 'initial-commit/', template.template, buildSpecContents);

        ConsoleUtil.LogInfo(`creating codecommit / codebuild and codepipeline resoures using cloudformmation...`);
        await this.executeStack(path + codePipelineTemplateFileName, command.region, stateBucketName, resourcePrefix, stackName );

        await template.state.save(storageProvider);

        await AwsUtil.DeleteObject(stateBucketName, 'initial-commit.zip');
        ConsoleUtil.LogInfo('done');

    }

    public uploadInitialCommit(stateBucketName: string, initialCommitPath: string, templateContents: string, buildSpecContents: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const s3client = new S3();
                const output = new WritableStream();
                const archive = archiver('zip');

                archive.on('error', reject);

                archive.on('end', () => {
                    const uploadRequest: PutObjectRequest = {
                        Body: output.toBuffer(),
                        Key: `initial-commit.zip`,
                        Bucket: stateBucketName,
                    };

                    s3client.upload(uploadRequest)
                        .promise()
                        .then(() => resolve())
                        .catch(reject);
                });

                archive.pipe(output);
                archive.directory(initialCommitPath, false);
                archive.append(buildSpecContents, {name: 'buildspec.yml'});
                archive.append(templateContents, { name: 'templates/organization.yml' });

                archive.finalize();
        } catch (err) {
            reject(err);
        }
    });
    }

    public async executeStack(cfnTemplatePath: string, region: string, stateBucketName: string, resourcePrefix: string, stackName: string) {

        const cfnTemplate = readFileSync(cfnTemplatePath).toString('utf8');
        const cfn = new CloudFormation({ region });
        const stackInput: CreateStackInput | UpdateStackInput = {
            StackName: stackName,
            TemplateBody: cfnTemplate,
            Capabilities: ['CAPABILITY_NAMED_IAM', 'CAPABILITY_IAM'],
            Parameters: [
                {ParameterKey: 'stateBucketName', ParameterValue: stateBucketName},
                {ParameterKey: 'resourcePrefix', ParameterValue: resourcePrefix},
            ],
        };

        try {
            await cfn.updateStack(stackInput).promise();
            await cfn.waitFor('stackUpdateComplete', { StackName: stackName, $waiter: { delay: 1, maxAttempts: 60 * 30 } }).promise();
        } catch (err) {
            if (err && err.code === 'ValidationError' && err.message) {
                const message = err.message as string;
                if (-1 !== message.indexOf('ROLLBACK_COMPLETE')) {
                    await cfn.deleteStack({ StackName: stackName }).promise();
                    await cfn.waitFor('stackDeleteComplete', { StackName: stackName, $waiter: { delay: 1 } }).promise();
                    await cfn.createStack(stackInput).promise();
                    await cfn.waitFor('stackCreateComplete', { StackName: stackName, $waiter: { delay: 1, maxAttempts: 60 * 30 } }).promise();
                } else if (-1 !== message.indexOf('does not exist')) {
                    await cfn.createStack(stackInput).promise();
                    await cfn.waitFor('stackCreateComplete', { StackName: stackName, $waiter: { delay: 1, maxAttempts: 60 * 30 } }).promise();
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
    }

    private createBuildSpecContents(path: string, command: IInitPipelineCommandArgs, stateBucketName: string) {
        let buildSpecContents = readFileSync(path + 'buildspec.yml').toString('utf-8');

        buildSpecContents = buildSpecContents.replace('XXX-ARGS', '--state-bucket-name ' + stateBucketName + ' XXX-ARGS');

        if (command.stateObject) {
            buildSpecContents = buildSpecContents.replace('XXX-ARGS', '--state-object ' + command.stateObject + ' XXX-ARGS');
        }
        buildSpecContents = buildSpecContents.replace('XXX-ARGS', '');
        return buildSpecContents;
    }
}

export interface IInitPipelineCommandArgs extends ICommandArgs {
    region: string;
    stackName: string;
    resourcePrefix: string;
    repositoryName: string;
}
