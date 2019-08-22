"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class CfnTransform {
    constructor(template, state) {
        this.template = template;
        this.state = state;
    }
    createTemplateForBinding(target) {
        const resources = {};
        const resultingTemplate = {
            AWSTemplateFormatVersion: '2010-09-09',
            Description: this.template.contents.Description,
            Parameters: this.template.contents.Parameters,
            Metadata: this.template.contents.Metadata,
            Resources: resources,
            Mappings: this.template.contents.Mappings,
            Conditions: this.template.contents.Conditions,
            Outputs: this.template.contents.Outputs,
        };
        for (const resource of target.resources) {
            const resourceForTemplate = this.resolveOrganizationFunctions(resource.resourceForTemplate);
            resources[resource.logicalId] = resourceForTemplate;
        }
        for (const prop in resultingTemplate) {
            if (!resultingTemplate[prop]) {
                delete resultingTemplate[prop];
            }
        }
        return JSON.stringify(resultingTemplate, null, 2);
    }
    resolveOrganizationFunctions(resource) {
        if (resource !== null && typeof resource === 'object') {
            const entries = Object.entries(resource);
            if (entries.length === 1) {
                const [key, val] = entries[0];
                if (key === 'Ref') {
                    const orgResource = this.template.organizationSection.resources.find((x) => x.logicalId === val);
                    const binding = this.state.getBinding(orgResource.type, orgResource.logicalId);
                    return binding.physicalId;
                }
            }
            for (const [key, val] of entries) {
                if (val !== null && typeof val === 'object') {
                    resource[key] = this.resolveOrganizationFunctions(val);
                }
            }
        }
        return resource;
    }
}
exports.CfnTransform = CfnTransform;
//# sourceMappingURL=cfn-transform.js.map