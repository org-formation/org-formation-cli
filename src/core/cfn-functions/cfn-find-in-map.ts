import { ICfnFunctionContext } from './cfn-functions';
import { OrgFormationError } from '~org-formation-error';

export type CfnMappingsSection = Record<string, Record<string, Record<string, string>>>;

export class CfnFindInMap {

    static resolve(context: ICfnFunctionContext, resource: any, resourceParent: any, resourceKey: string, key: string, val: any): void {
        if (key === 'Fn::FindInMap')
        {
            if (!Array.isArray(val)) {
                if (!context.finalPass) { return; }
                throw new OrgFormationError(`Fn::FindInMap expression expects an array as value. Found ${typeof val}`);
            }
            if (Array.isArray(val) && val.length !== 3) {
                if (!context.finalPass) { return; }
                throw new OrgFormationError(`Fn::FindInMap expression expects an array of 3 elements as value. Found an array of ${val.length}`);
            }

            for(const element of val) {
                if (typeof element !== 'string') {
                    if (!context.finalPass) { return; }
                    throw new OrgFormationError(`Unable to resolve FindInMap expression. Not all arguments are of type String. Does this contain an expression that could not fully resolve?\n ${JSON.stringify(element)}`);
                }
            }
            const mapName = val[0] as string;
            const groupName = val[1] as string;
            const keyName = val[2] as string;

            const found = CfnFindInMap.findInMap(context.mappings, mapName, groupName, keyName);

            resourceParent[resourceKey] = found;
        }
    }

    static findInMap(mappings: CfnMappingsSection, mapName: string, groupName: string, keyName: string): string {
        if (mappings === undefined) {
            throw new OrgFormationError('Unable to perform FindInMap as there is no mappings section found.');
        }

        const mapNames = Object.keys(mappings);
        if (mapNames.length === 0) {
            throw new OrgFormationError('Unable to perform FindInMap as there is the mappings section is empty.');
        }

        const map = mappings[mapName];
        if (map === undefined)  {
            throw new OrgFormationError(`Unable to find map with name ${mapName}. Did find maps with the following names ${mapNames.join(', ')}`);
        }

        const groupNames = Object.keys(map);
        if (groupNames.length === 0) {
            throw new OrgFormationError(`Map with name ${mapName} does not contain any groups.`);
        }

        const group = map[groupName];
        if (group === undefined)  {
            throw new OrgFormationError(`Unable to find group with name ${groupName} in map  ${mapName}. Did find groups with the following names ${groupNames.join(', ')}`);
        }

        const keyNames = Object.keys(group);
        if (keyNames.length === 0) {
            throw new OrgFormationError(`Group with name ${groupName} (${mapName}) does not contain any keys.`);
        }

        const val = group[keyName];

        return val;
    }
}
