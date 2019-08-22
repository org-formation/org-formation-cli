"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const account_resource_1 = require("./account-resource");
const master_account_resource_1 = require("./master-account-resource");
const organization_root_resource_1 = require("./organization-root-resource");
const organizational_unit_resource_1 = require("./organizational-unit-resource");
const resource_types_1 = require("./resource-types");
const service_control_policy_resource_1 = require("./service-control-policy-resource");
class OrganizationSection {
    constructor(root, contents) {
        this.resources = [];
        this.accounts = [];
        this.organizationalUnits = [];
        this.serviceControlPolicies = [];
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
            if (resource instanceof master_account_resource_1.MasterAccountResource) {
                if (this.masterAccount) {
                    throw new Error(`organization section cannot have multiple master account resources`);
                }
                this.masterAccount = resource;
            }
            else if (resource instanceof organization_root_resource_1.OrganizationRootResource) {
                if (this.organizationRoot) {
                    throw new Error(`organization section cannot have multiple organization roots`);
                }
                this.organizationRoot = resource;
            }
            else if (resource instanceof account_resource_1.AccountResource) {
                this.accounts.push(resource);
            }
            else if (resource instanceof organizational_unit_resource_1.OrganizationalUnitResource) {
                this.organizationalUnits.push(resource);
            }
            else if (resource instanceof service_control_policy_resource_1.ServiceControlPolicyResource) {
                this.serviceControlPolicies.push(resource);
            }
        }
        const accountIds = this.accounts.map((acc) => acc.accountId).filter((x) => x);
        const rootEmails = this.accounts.map((acc) => acc.rootEmail).filter((x) => x);
        const accountNames = this.accounts.map((acc) => acc.accountName);
        if (this.masterAccount) {
            if (this.masterAccount.accountId) {
                accountIds.push(this.masterAccount.accountId);
                accountIds.sort();
            }
            if (this.masterAccount.rootEmail) {
                rootEmails.push(this.masterAccount.rootEmail);
            }
            if (this.masterAccount.accountName) {
                accountNames.push(this.masterAccount.accountName);
            }
        }
        const organizationUnitNames = this.organizationalUnits.map((ou) => ou.organizationalUnitName);
        const serviceControlPolicies = this.serviceControlPolicies.map((policy) => policy.policyName);
        this.throwForDuplicateVale(accountIds, (duplicate) => new Error(`multiple accounts found with AccountId ${duplicate}`));
        this.throwForDuplicateVale(rootEmails, (duplicate) => new Error(`multiple accounts found with RootEmail ${duplicate}`));
        this.throwForDuplicateVale(accountNames, (duplicate) => new Error(`multiple accounts found with AccountName ${duplicate}`));
        this.throwForDuplicateVale(organizationUnitNames, (duplicate) => new Error(`multiple organizational units found with OrganizationalUnitName ${duplicate}`));
        this.throwForDuplicateVale(serviceControlPolicies, (duplicate) => new Error(`multiple service control policies found with policyName ${duplicate}`));
    }
    resolveRefs() {
        for (const resource of this.resources) {
            try {
                resource.resolveRefs();
            }
            catch (err) { // todo: move one level up!
                let reason = 'unknown';
                if (err && err.message) {
                    reason = err.message;
                }
                throw new Error(`unable to load references for organizational resource ${resource.logicalId}, reason: ${reason}`);
            }
        }
    }
    createResource(id, resource) {
        switch (resource.Type) {
            case resource_types_1.OrgResourceTypes.MasterAccount:
                return new master_account_resource_1.MasterAccountResource(this.root, id, resource);
            case resource_types_1.OrgResourceTypes.OrganizationRoot:
                return new organization_root_resource_1.OrganizationRootResource(this.root, id, resource);
            case resource_types_1.OrgResourceTypes.Account:
                return new account_resource_1.AccountResource(this.root, id, resource);
            case resource_types_1.OrgResourceTypes.OrganizationalUnit:
                return new organizational_unit_resource_1.OrganizationalUnitResource(this.root, id, resource);
            case resource_types_1.OrgResourceTypes.ServiceControlPolicy:
                return new service_control_policy_resource_1.ServiceControlPolicyResource(this.root, id, resource);
            default:
                if (resource.Type === undefined) {
                    throw new Error(`unexpected attribute ${id} found in Organization section`);
                }
                throw new Error(`attribute ${id} has unknown type ${resource.Type}`);
        }
    }
    throwForDuplicateVale(arr, fnError) {
        const sortedArr = arr.sort();
        for (let i = 0; i < sortedArr.length - 1; i++) {
            if (sortedArr[i + 1] === sortedArr[i]) {
                const duplicate = sortedArr[i];
                throw fnError(duplicate);
            }
        }
    }
}
exports.OrganizationSection = OrganizationSection;
//# sourceMappingURL=organization-section.js.map