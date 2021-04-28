
import path from 'path';
import { existsSync, readFileSync, statSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { readdirSync } from 'fs';
import fetch from 'node-fetch';
import unzipper from 'unzipper';
import tmp from 'tmp';
import { renderString } from 'nunjucks';
import { S3 } from 'aws-sdk';
import archiver from 'archiver';
import { PutObjectRequest } from 'aws-sdk/clients/s3';
import { WritableStream } from 'memory-streams';
import { CredentialsOptions } from 'aws-sdk/lib/credentials';

type TemplateParameters = { name: string; required: boolean }[];

export class InitialCommitUtil {
  static async parameterizeAndUpload(packageUrl: string, params: Record<string, any>, stateBucketName: string, s3credentials?: CredentialsOptions): Promise<void> {

    const tempDir = tmp.dirSync();
    const response = await fetch(packageUrl);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`downloading ${packageUrl} failed. received: ${response.status} ${response.statusText} `);
    }
    await response.body.pipe(unzipper.Extract({ path: tempDir.name })).promise();

    const parametersFilePath = path.join(tempDir.name, 'template-parameters.json');
    if (!existsSync(parametersFilePath)) {
      throw new Error('template zip must contain a root level template-parameters.json file');
    }
    const declaredParameters = JSON.parse(readFileSync(parametersFilePath).toString()) as TemplateParameters;
    for (const declaredParam of declaredParameters) {
      if ((declaredParam.required) && (params[declaredParam.name] === undefined)) {
        throw new Error(`template zip declares required parameter ${declaredParam.name}, which is not provided.`);
      }
    }

    this.replaceFiles(tempDir.name, params);

    await InitialCommitUtil.uploadInitialCommit(s3credentials, stateBucketName, tempDir.name);
  }

  static replaceFiles(dir: string, params: Record<string, any>): void {
    const subdirs = readdirSync(dir);
    for (const subdir of subdirs) {
      const res = resolve(dir, subdir);
      const isdir = statSync(res).isDirectory();
      if (isdir) {
        this.replaceFiles(res, params);
      } else {
        const source = readFileSync(res).toString('utf8');
        const contents = renderString(source, params);
        writeFileSync(res, contents);
      }
    }
  }

  static async uploadInitialCommit(credentials: CredentialsOptions | undefined, stateBucketName: string, dir: string): Promise<void> {
    const s3client = new S3({ credentials });
    const output = new WritableStream();
    const archive = archiver('zip');

    archive.pipe(output);
    archive.directory(dir, false);

    await archive.finalize();

    const uploadRequest: PutObjectRequest = {
      Body: output.toBuffer(),
      Key: 'initial-commit.zip',
      Bucket: stateBucketName,
    };

    await s3client.upload(uploadRequest).promise();
  }
}
