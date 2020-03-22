import { ConsoleUtil } from '../../console-util';
import { BaseCliCommand, ICommandArgs } from '../base-command';
import { Md5Util } from '../../../src/md5-util';
import { ServerlessComBinder, IServerlessComTask } from '~commands/serverless/serverless-com-binder';
import { DefaultTaskRunner } from '~core/default-task-runner';
import { IOrganizationBinding, TemplateRoot } from '~parser/parser';
import md5 = require('md5');

export class UpdateSlsCommand extends BaseCliCommand<IUpdateSlsCommandArgs> {

    static async Perform(command: IUpdateSlsCommandArgs): Promise<void> {
        const x = new UpdateSlsCommand();
        await x.performCommand(command);
    }

    protected async performCommand(command: IUpdateSlsCommandArgs): Promise<void> {

        const hashOfServerlessDirectory = Md5Util.Md5OfPath(command.path);
        const hashOfTask = md5(JSON.stringify({
            organizationFileHash: command.organizationFileHash,
            stage: command.stage,
            configFile: command.configFile,
            runNpmInstall: command.runNpmInstall,
            path: hashOfServerlessDirectory }));

        const task: IServerlessComTask = {
            type: ServerlessGenericTaskType,
            name: command.name,
            stage: command.stage,
            path: command.path,
            configFile: command.configFile,
            hash: hashOfTask,
            runNpmInstall: command.runNpmInstall,
        };

        const state = await this.getState(command);
        const template = TemplateRoot.create(command.organizationFile, {}, command.organizationFileHash);
        const binder = new ServerlessComBinder(task, state, template, command.organizationBinding);
        const tasks = binder.enumTasks();

        if (tasks.length === 0) {
            ConsoleUtil.LogInfo(`serverless.com workload ${command.name} already up to date.`);
        } else {
            try {
                await DefaultTaskRunner.RunTasks(tasks, command.name, command.maxConcurrent, command.failedTolerance);
            } finally {
                await state.save();
            }
            ConsoleUtil.LogInfo('done');
        }
    }
}

export interface IUpdateSlsCommandArgs extends ICommandArgs {
    name: string;
    stage?: string;
    path: string;
    configFile?: string;
    runNpmInstall: boolean;
    organizationBinding: IOrganizationBinding;
    organizationFile?: string;
    organizationFileHash?: string;
    maxConcurrent: number;
    failedTolerance: number;
}

export const ServerlessGenericTaskType = 'serverless.com';
