"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const resource_1 = require("./resource");
class OrganizationalUnitResource extends resource_1.Resource {
    constructor(root, id, resource) {
        super(root, id, resource);
        this.props = this.resource.Properties;
        if (!this.props.OrganizationalUnitName) {
            throw new Error(`OrganizationalUnitName is missing on Organizational Unit ${id}`);
        }
        this.tags = this.props.Tags;
        this.organizationalUnitName = this.props.OrganizationalUnitName;
        super.throwForUnknownAttributes(this.props, id, 'OrganizationalUnitName', 'Accounts', 'ServiceControlPolicies', 'Tags');
    }
    resolveRefs() {
        this.accounts = super.resolve(this.props.Accounts, this.root.organizationSection.accounts);
        this.serviceControlPolicies = super.resolve(this.props.ServiceControlPolicies, this.root.organizationSection.serviceControlPolicies);
        const accountWithOtherOrgUnit = this.accounts.find((x) => x.TemplateResource && (x.TemplateResource.organizationalUnitName !== undefined));
        if (accountWithOtherOrgUnit) {
            throw new Error(`account ${accountWithOtherOrgUnit.TemplateResource.logicalId} is part of multiple organizational units, at least ${this.logicalId} and ${accountWithOtherOrgUnit.TemplateResource.organizationalUnitName}.`);
        }
        for (const account of this.accounts) {
            if (account.TemplateResource) {
                account.TemplateResource.organizationalUnitName = this.logicalId;
            }
        }
    }
}
exports.OrganizationalUnitResource = OrganizationalUnitResource;
//# sourceMappingURL=organizational-unit-resource.js.map