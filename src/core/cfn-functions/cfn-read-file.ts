import { readFileSync } from 'fs';
import path from 'path';
import { ICfnFunctionContext } from './cfn-functions';
import { OrgFormationError } from '~org-formation-error';
const fs = require('fs')
const url = require('url');
const { schema } = require('yaml-cfn');
const fetch = require('node-fetch');
const yaml = require('js-yaml');

async function fetchAndDecode(urlRef: string) {
    let response = await fetch(urlRef);
    let content;
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    else {
        const urlPath = url.parse(urlRef, true).pathname;
        const fileExt = path.extname(urlPath);
        if (fileExt === '.json') {
            content = await response.json();
        } else if (fileExt === '.yaml' || fileExt === '.yml') {
            let reeText = await response.text();
            content = yaml.load(reeText, { schema: schema })
        } else {
            content = await response.text();
        }
        return content;
    }
}

export class CfnReadFile {

    static async resolve(context: ICfnFunctionContext, resource: any, resourceParent: any, resourceKey: string, key: string, val: any): Promise<void> {
        if (key === 'Fn::ReadFile')
        {
            if (typeof val !== 'string') {
                if (!context.finalPass) { return; }
                throw new OrgFormationError(`Fn::ReadFile expression expects a string as value. Found ${typeof val}`);
            }
            let resolved;
            if (val.startsWith('http')) {
                resolved = await fetchAndDecode(val);
            } else {
                resolved = CfnReadFile.readFile(context.filePath, val);
            }
            resourceParent[resourceKey] = resolved;
        }
    }

    static readFile(contextPath: string, filePath: string): string {
        const dir = path.dirname(contextPath);
        const resolvedFilePath = path.resolve(dir, filePath);
        return readFileSync(resolvedFilePath).toString('utf-8');
    }
}
