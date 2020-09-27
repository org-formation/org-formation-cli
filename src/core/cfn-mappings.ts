import { OrgFormationError } from '~org-formation-error';
import { ICfnFunctionExpression } from '~util/resource-util';

export type CfnMappingsSection = Record<string, Record<string, Record<string, string>>>;

export class CfnMappings {

    static accept(key: string, val: unknown): boolean {
        return (key === 'Fn::FindInMap' && typeof val === 'object' && Array.isArray(val));
    }

    static create(resource: any, resourceParent: any, resourceKey: string): ICfnFunctionExpression {
        return {
            type: 'FindInMap',
            target: resource,
            resolveToValue: (x: string): void => { resourceParent[resourceKey] = x; },
        };
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
        if (typeof val !== 'string')  {
            throw new OrgFormationError(`Unable to find key with name ${groupName} in group ${groupName} (${mapName}) . Did find groups with the following names ${keyNames.join(', ')}`);
        }

        return val;


    }
}
