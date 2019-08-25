"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const resource_1 = require("./resource");
class OrganizationRootResource extends resource_1.Resource {
    constructor(root, id, resource) {
        super(root, id, resource);
        this.props = this.resource.Properties;
        super.throwForUnknownAttributes(this.props, id, 'ServiceControlPolicies');
    }
    resolveRefs() {
        this.serviceControlPolicies = super.resolve(this.props.ServiceControlPolicies, this.root.organizationSection.serviceControlPolicies);
    }
}
exports.OrganizationRootResource = OrganizationRootResource;
//# sourceMappingURL=organization-root-resource.js.map