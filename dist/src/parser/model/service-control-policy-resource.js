"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const resource_1 = require("./resource");
class ServiceControlPolicyResource extends resource_1.Resource {
    constructor(root, id, resource) {
        super(root, id, resource);
        const props = this.resource.Properties;
        if (!props.PolicyName) {
            throw new Error(`PolicyName is missing on Service Control Policy ${id}`);
        }
        if (!props.PolicyDocument) {
            throw new Error(`PolicyDocument is missing on Service Control Policy ${id}`);
        }
        this.policyName = props.PolicyName;
        this.description = props.Description;
        this.policyDocument = props.PolicyDocument;
        super.throwForUnknownAttributes(props, id, 'PolicyName', 'Description', 'PolicyDocument', 'Tags');
    }
}
exports.ServiceControlPolicyResource = ServiceControlPolicyResource;
//# sourceMappingURL=service-control-policy-resource.js.map