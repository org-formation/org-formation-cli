
import path from 'path';
import { existsSync, readFileSync, statSync, writeFileSync } from 'fs';
import { readdirSync } from 'fs';
import stream from 'stream';
import fetch from 'node-fetch';
import unzipper from 'unzipper';
import tmp from 'tmp';
import { renderString } from 'nunjucks';
import * as S3 from '@aws-sdk/client-s3';
import archiver from 'archiver';
import { Upload } from '@aws-sdk/lib-storage';
import { DefaultTemplate, ITemplateGenerationSettings } from '~writer/default-template-writer';

interface TemplateDefinition {
  parameters: { name: string; required: boolean }[];
  organizationFilePath: string;
  templateGenerationSettings?: ITemplateGenerationSettings;
}

export interface ExtractedTemplate {
  definition: TemplateDefinition;
  tempDir: string;
}
export class InitialCommitUtil {

  static async extractTemplate(packageUrl: string): Promise<ExtractedTemplate> {
    const tempDir = tmp.dirSync();
    const response = await fetch(packageUrl);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`downloading ${packageUrl} failed. received: ${response.status} ${response.statusText} `);
    }
    await response.body.pipe(unzipper.Extract({ path: tempDir.name })).promise();

    const parametersFilePath = path.join(tempDir.name, 'template.json');
    if (!existsSync(parametersFilePath)) {
      throw new Error('template zip must contain a root level template.json file');
    }
    const definition = JSON.parse(readFileSync(parametersFilePath).toString()) as TemplateDefinition;


    return {
      definition,
      tempDir: tempDir.name,
    };
  }


  static async parameterizeAndUpload(extractedTemplate: ExtractedTemplate, params: Record<string, any>, template: DefaultTemplate, stateBucketName: string, s3client: S3.S3Client): Promise<void> {
    const { definition: templateDefinition, tempDir } = extractedTemplate;
    for (const declaredParam of templateDefinition.parameters) {
      if ((declaredParam.required) && (params[declaredParam.name] === undefined)) {
        throw new Error(`template zip declares required parameter ${declaredParam.name}, which is not provided.`);
      }
    }
    const archive = archiver('zip');
    const upload = uploadStream(stateBucketName, 'initial-commit.zip', s3client);
    archive.pipe(upload.writeStream);
    this.replaceFiles(tempDir, params, archive, '');
    const renderedTemplateContents = renderString(template.template, params);
    archive.append(renderedTemplateContents, { name: templateDefinition.organizationFilePath });
    await archive.finalize();
    await upload.promise;
  }

  static replaceFiles(dir: string, params: Record<string, any>, archive: archiver.Archiver, relDir: string): void {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const res = path.resolve(dir, entry);
      const isdir = statSync(res).isDirectory();
      if (isdir) {
        this.replaceFiles(res, params, archive, relDir + '/' + entry);
      } else if (entry === 'template-parameters.json' && relDir === '') {
        continue;
      } else {
        const source = readFileSync(res).toString('utf8');
        const contents = renderString(source, params);
        archive.append(contents, { name: relDir + '/' + entry });
        writeFileSync(res, contents);
      }
    }
  }

}

const uploadStream = (bucket: string, key: string, s3: S3.S3Client): { writeStream: stream.PassThrough; promise: Promise<any> } => {
  const pass = new stream.PassThrough();
  return {
    writeStream: pass,
    promise: new Upload({
      client: s3,
      params: { Bucket: bucket, Key: key, Body: pass },
    }).done(),
  };
};
