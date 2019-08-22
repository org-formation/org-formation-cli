"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const md5 = require("md5");
const cloudformation_resource_1 = require("./cloudformation-resource");
const cloudformation_stack_resource_1 = require("./cloudformation-stack-resource");
const resource_types_1 = require("./resource-types");
class ResourcesSection {
    constructor(root, contents) {
        this.resources = [];
        this.stacks = [];
        this.root = root;
        this.contents = contents;
        if (!this.contents) {
            return;
        }
        for (const id in this.contents) {
            const resource = this.createResource(id, this.contents[id]);
            this.resources.push(resource);
        }
        for (const resource of this.resources) {
            if (resource instanceof cloudformation_stack_resource_1.CloudFormationStackResource) {
                this.stacks.push(resource);
            }
        }
    }
    resolveRefs() {
        for (const resource of this.resources) {
            resource.resolveRefs();
        }
    }
    enumTemplateTargets() {
        const map = new Map();
        for (const resource of this.resources) {
            for (const account of resource.getNormalizedBoundAccounts()) {
                for (const region of resource.regions) {
                    const key = `${account}${region}`;
                    const current = map.get(key);
                    if (current === undefined) {
                        map.set(key, {
                            hash: 'TO_BE_CALCULATED',
                            accountLogicalId: account,
                            region,
                            resources: [resource],
                        });
                    }
                    else {
                        current.resources.push(resource);
                    }
                }
            }
        }
        for (const resourceTarget of map.values()) {
            const sortedResourceHashes = resourceTarget.resources.map((x) => x.calculateHash()).sort();
            const resources = JSON.stringify(sortedResourceHashes);
            resourceTarget.hash = md5(resources);
        }
        return Array.from(map.values());
    }
    createResource(id, resource) {
        switch (resource.Type) {
            case resource_types_1.ResourceTypes.StackResource:
                return new cloudformation_stack_resource_1.CloudFormationStackResource(this.root, id, resource);
            default:
                return new cloudformation_resource_1.CloudFormationResource(this.root, id, resource);
        }
    }
}
exports.ResourcesSection = ResourcesSection;
//# sourceMappingURL=resources-section.js.map