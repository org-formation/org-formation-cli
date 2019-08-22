"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const md5 = require("md5");
const validator_1 = require("../validator");
class Resource {
    constructor(root, id, resource) {
        if (resource.Properties === undefined) {
            throw new Error(`Properties are missing for resource ${id}`);
        }
        this.root = root;
        this.logicalId = id;
        this.resource = resource;
        this.type = resource.Type;
        this.throwForUnknownAttributes(resource, id, 'Type', 'Properties');
    }
    calculateHash() {
        const s = JSON.stringify(this.resource, null, 2);
        return md5(s);
    }
    resolveRefs() {
    }
    throwForUnknownAttributes(obj, id, ...knownAttributes) {
        validator_1.Validator.ThrowForUnknownAttribute(obj, `resource ${id}`, ...knownAttributes);
    }
    resolve(val, list) {
        if (val === undefined) {
            return [];
        }
        if (val === '*') {
            return list.map((x) => ({ TemplateResource: x }));
        }
        const results = [];
        if (!Array.isArray(val)) {
            val = [val];
        }
        for (const elm of val) {
            if (typeof elm === 'string' || typeof elm === 'number') {
                results.push({ PhysicalId: '' + elm });
            }
            else if (elm instanceof Object) {
                const ref = elm.Ref;
                const foundElm = list.find((x) => x.logicalId === ref);
                if (foundElm === undefined) {
                    throw new Error(`unable to find resource named ${ref}`);
                }
                results.push({ TemplateResource: foundElm });
            }
        }
        return results;
    }
}
exports.Resource = Resource;
//# sourceMappingURL=resource.js.map