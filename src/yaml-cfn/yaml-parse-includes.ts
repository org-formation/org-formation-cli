import { readFileSync } from 'fs';
import { yamlParse } from '.';
import { CfnInclude } from '~core/cfn-functions/cfn-include';


export const yamlParseWithIncludes = (filePath: string): any => {

    const buffer = readFileSync(filePath);
    const contents = buffer.toString('utf-8');
    const parsed = yamlParse(contents);
    processIncludes(filePath, parsed);
    return parsed;
};


const processIncludes = (path: string, resource: any, resourceParent?: any, resourceKey?: string): any => {
    if (resource !== null && typeof resource === 'object') {
        const entries = Object.entries(resource);

        for (const [key, val] of entries) {
            if (val !== null && typeof val === 'object') {
                processIncludes(path, val, resource, key);
            }
        }

        if (entries.length === 1 && resourceParent !== undefined && resourceKey !== undefined) {
            const [key, val]: [string, unknown] = entries[0];
            if (key === 'Fn::Include') {
                CfnInclude.resolve(path, resource, resourceParent, resourceKey, key, val);
            }
        }
    }
};

