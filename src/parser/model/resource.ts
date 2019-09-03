import md5 = require('md5');
import { OrgFormationError } from '../../org-formation-error';
import { IResource, IResourceRef, IResourceRefExpression, TemplateRoot } from '../parser';
import { Validator } from '../validator';
import { OrgResourceTypes, ResourceTypes } from './resource-types';

export interface Reference<TResource extends Resource> {
   PhysicalId?: string;
   TemplateResource?: TResource;
}

export abstract class Resource {
    public readonly logicalId: string;
    public readonly type: OrgResourceTypes | ResourceTypes;
    protected readonly root: TemplateRoot;
    protected readonly resource: IResource;

    constructor(root: TemplateRoot, id: string, resource: IResource) {

        this.root = root;
        this.logicalId = id;
        this.resource = resource;
        this.type = resource.Type;

        this.throwForUnknownAttributes(resource, id, 'Type', 'Properties');
    }

    public calculateHash(): string {
        const s = JSON.stringify(this.resource, null, 2);
        return md5(s);
    }

    public resolveRefs() {

    }

    protected throwForUnknownAttributes(obj: any, id: string, ...knownAttributes: string[]) {
        Validator.ThrowForUnknownAttribute(obj, `resource ${id}`, ...knownAttributes);
    }

    protected resolve<T extends Resource>(val: IResourceRef | IResourceRef[], list: T[] ): Array<Reference<T>> {
        if (val === undefined) {
            return [];
        }
        if (val === '*') {
            return list.map((x) => ({TemplateResource: x}));
        }
        const results: Array<Reference<T>> = [];
        if (!Array.isArray(val)) {
            val = [val];
        }
        for (const elm of val) {
            if (typeof elm === 'string' || typeof elm === 'number') {
                results.push({PhysicalId: '' + elm});
            } else if (elm instanceof Object) {
                const ref = (elm as IResourceRefExpression).Ref;
                const foundElm = list.find((x) => x.logicalId === ref);
                if (foundElm === undefined) {
                    throw new OrgFormationError(`unable to find resource named ${ref}`);
                }
                results.push({TemplateResource: foundElm});
            }
        }
        return results;
    }
}
