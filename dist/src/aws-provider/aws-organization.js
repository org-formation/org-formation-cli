"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class AwsOrganization {
    constructor(reader) {
        this.reader = reader;
    }
    startInitialize() {
        this.initializationPromise = this.initialize();
    }
    async initialize() {
        const setOrgPromise = async () => { this.organization = await this.reader.organization.getValue(); };
        const setRootsPromise = async () => { this.roots = await this.reader.roots.getValue(); };
        const setPolicies = async () => { this.policies = await this.reader.policies.getValue(); };
        const setAccounts = async () => {
            const accounts = await this.reader.accounts.getValue();
            this.masterAccount = accounts.find((x) => x.Id === this.organization.MasterAccountId);
            this.accounts = accounts.filter((x) => x.Id !== this.organization.MasterAccountId);
            this.organizationalUnits = await this.reader.organizationalUnits.getValue();
        };
        await Promise.all([setOrgPromise(), setRootsPromise(), setPolicies(), setAccounts()]);
    }
    async endInitialize() {
        await this.initializationPromise;
    }
}
exports.AwsOrganization = AwsOrganization;
//# sourceMappingURL=aws-organization.js.map