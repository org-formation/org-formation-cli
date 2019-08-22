"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const md5 = require("md5");
const resource_1 = require("./resource");
class CloudFormationResource extends resource_1.Resource {
    constructor(root, id, resource) {
        super(root, id, resource);
        this.bindings = this.resource.OrganizationBindings;
        if (this.bindings) {
            this.includeMasterAccount = this.bindings.IncludeMasterAccount;
            if (typeof this.bindings.Regions === 'string') {
                this.regions = [this.bindings.Regions];
            }
            else {
                this.regions = this.bindings.Regions;
            }
        }
        else {
            this.accounts = [];
            this.organizationalUnits = [];
            this.regions = [];
        }
        const resourceString = JSON.stringify(resource);
        this.resourceHash = md5(resourceString);
        this.resourceForTemplate = JSON.parse(JSON.stringify(resource));
        delete this.resourceForTemplate.OrganizationBindings;
    }
    calculateHash() {
        return this.resourceHash;
    }
    resolveRefs() {
        if (this.bindings) {
            this.accounts = super.resolve(this.bindings.Accounts, this.root.organizationSection.accounts);
            this.organizationalUnits = super.resolve(this.bindings.OrganizationalUnits, this.root.organizationSection.organizationalUnits);
        }
    }
    getNormalizedBoundAccounts() {
        const result = this.accounts.map((x) => x.TemplateResource.logicalId);
        for (const unit of this.organizationalUnits) {
            const accountsForUnit = unit.TemplateResource.accounts.map((x) => x.TemplateResource.logicalId);
            result.push(...accountsForUnit);
        }
        if (this.includeMasterAccount) {
            //todo: get real master account ref
            //todo: validate whether master account is in template
            result.push('MasterAccount');
        }
        return result;
    }
}
exports.CloudFormationResource = CloudFormationResource;
//# sourceMappingURL=cloudformation-resource.js.map