import { CfnFindInMap, CfnMappingsSection } from './cfn-find-in-map';
import { CfnJoin } from './cfn-join';
import { CfnJsonString } from './cfn-json-string';
import { CfnMD5 } from './cfn-md5';
import { CfnMerge } from './cfn-merge';
import { CfnReadFile } from './cfn-read-file';
import { CfnSelect } from './cfn-select';
import { CfnSub } from './cfn-sub';

export class CfnFunctions {

    static resolveStructuralOrgFormationFunctions(context: ICfnFunctionContext, resource: any, resourceParent: any, resourceKey: string, key: string, val: any): void {
        CfnReadFile.resolve(context, resource, resourceParent, resourceKey, key, val);
        CfnMD5.resolve(context, resource, resourceParent, resourceKey, key, val);
        CfnJsonString.resolve(context, resource, resourceParent, resourceKey, key, val);
    }

    static resolveStructuralCloudFormationFunctions(context: ICfnFunctionContext, resource: any, resourceParent: any, resourceKey: string, key: string, val: any): void {
        CfnFindInMap.resolve(context, resource, resourceParent, resourceKey, key, val);
        CfnSelect.resolve(context, resource, resourceParent, resourceKey, key, val);
        CfnJoin.resolve(context, resource, resourceParent, resourceKey, key, val);

        if (context.finalPass) {
            CfnSub.resolve(context, resource, resourceParent, resourceKey, key, val);
        }
    }

    static resolveTreeStructural<T>(context: ICfnFunctionContext, polyfillCloudFormation: boolean, resource: T, resourceParent?: any, resourceKey?: string): T {
        if (resource !== null && typeof resource === 'object') {
            const entries = Object.entries(resource);

            for (const [key, val] of entries) {
                if (key === '<<') {
                    CfnMerge.resolve(context, resource, resourceParent, resourceKey, key, val);
                }
                if (val !== null && typeof val === 'object') {
                    this.resolveTreeStructural(context, polyfillCloudFormation, val, resource, key);
                }
            }


            if (entries.length === 1 && resourceParent !== undefined && resourceKey !== undefined) {
                const [key, val]: [string, unknown] = entries[0];
                this.resolveStructuralOrgFormationFunctions(context, resource, resourceParent, resourceKey, key, val);
                if (polyfillCloudFormation) {
                    this.resolveStructuralCloudFormationFunctions(context, resource, resourceParent, resourceKey, key, val);
                }
            }
        }

        return resource;
    }

}

export interface ICfnFunctionContext {
    filePath: string;
    mappings: CfnMappingsSection;
    finalPass: boolean;
}
