// Type definitions for yaml-cfn.

import {SchemaDefinition} from 'js-yaml';

export const schema: SchemaDefinition;

export function yamlParse(str: string): any;
export function yamlDump(obj: any): string;
