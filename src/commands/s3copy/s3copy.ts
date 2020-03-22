import md5 from 'md5';
import { ConsoleUtil } from '../../../src/console-util';
import { Md5Util } from '../../../src/md5-util';
import { IS3CopyTask, S3CopyBinder } from './s3copy-binder';
import { BaseCliCommand, ICommandArgs } from '..';
import { TemplateRoot, IOrganizationBinding } from '~parser/parser';
import { DefaultTaskRunner } from '~core/default-task-runner';

export class S3CopyCommand extends BaseCliCommand<IS3CopyCommandArgs> {

    static async Perform(command: IS3CopyCommandArgs): Promise<void> {
        const x = new S3CopyCommand();
        await x.performCommand(command);
    }

    protected async performCommand(command: IS3CopyCommandArgs): Promise<void> {

        const hashOfTargetFileOrDir = Md5Util.Md5OfPath(command.localPath);
        const hashOfTask = md5(JSON.stringify({
            organizationFileHash: command.organizationFileHash,
            path: hashOfTargetFileOrDir,
            RemotePath: command.remotePath,
            ZipBeforePut: command.zipBeforePut,
         }));

        const task: IS3CopyTask = {
            type: S3CopyTaskType,
            name: command.name,
            hash: hashOfTask,
            remotePath: command.remotePath,
            zipBeforePut: command.zipBeforePut,
            localPath: command.localPath,
        };

        const state = await this.getState(command);
        const template = TemplateRoot.create(command.organizationFile, {}, command.organizationFileHash);
        const binder = new S3CopyBinder(task, state, template, command.organizationBinding);
        const tasks = binder.enumTasks();

        if (tasks.length === 0) {
            ConsoleUtil.LogInfo(`copy-to-s3 task ${command.name} already up to date.`);
        } else {
            try {
                await DefaultTaskRunner.RunTasks(tasks, command.name, 1, 0);
            } finally {
                await state.save();
            }
            ConsoleUtil.LogInfo('done');
        }
    }
}

export interface IS3CopyCommandArgs extends ICommandArgs {
    name: string;
    localPath: string;
    remotePath: string;
    zipBeforePut: boolean;
    organizationBinding: IOrganizationBinding;
    organizationFile?: string;
    organizationFileHash?: string;
    maxConcurrent: number;
    failedTolerance: number;
}

export const S3CopyTaskType = 'copy-to-s3';
