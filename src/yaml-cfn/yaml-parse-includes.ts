import { readFileSync } from 'fs';
import path from 'path';
import { yamlParse } from '.';

const include = /!Include\s+('|")?([^'"\s]*)('|")?/g;
export const yamlParseContentWithIncludes = (contents: string, directory: string): any => {
    const replacedContents = contents.replace(include, (_, __, includedRelativeFilePath) => {

        const resolvedFilePath = path.resolve(directory, includedRelativeFilePath);
        const included = yamlParseWithIncludes(resolvedFilePath);
        return JSON.stringify(included);
    });

    const parsed = yamlParse(replacedContents);
    return parsed;
};

export const yamlParseWithIncludes = (filePath: string): any => {
    const buffer = readFileSync(filePath);
    const contents = buffer.toString('utf-8');
    const dir = path.dirname(filePath);
    return yamlParseContentWithIncludes(contents, dir);
};
