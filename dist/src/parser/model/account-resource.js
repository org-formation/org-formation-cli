"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const resource_1 = require("./resource");
class AccountResource extends resource_1.Resource {
    constructor(root, id, resource) {
        super(root, id, resource);
        this.props = this.resource.Properties;
        if (!this.props.AccountId && !this.props.RootEmail) {
            throw new Error(`both AccountId and RootEmail are missing on Account ${id}`);
        }
        if (!this.props.AccountName) {
            throw new Error(`AccountName is missing on Account ${id}`);
        }
        this.rootEmail = this.props.RootEmail;
        this.accountName = this.props.AccountName;
        this.accountId = this.props.AccountId;
        this.tags = this.props.Tags;
        super.throwForUnknownAttributes(this.props, id, 'RootEmail', 'AccountName', 'AccountId', 'ServiceControlPolicies', 'Tags');
    }
    resolveRefs() {
        this.serviceControlPolicies = super.resolve(this.props.ServiceControlPolicies, this.root.organizationSection.serviceControlPolicies);
    }
}
exports.AccountResource = AccountResource;
//# sourceMappingURL=account-resource.js.map