import { AwsOrganizationReader, AWSAccount, AWSOrganizationalUnit, AWSPolicy } from "./aws-organization-reader";
import { PolicySummary, Organization, Root } from "aws-sdk/clients/organizations";

export class AwsOrganization {
    private readonly reader: AwsOrganizationReader;
    private initializationPromise: Promise<void>;
    organization: Organization;
    roots: Root[];
    organizationalUnits: AWSOrganizationalUnit[];
    policies: AWSPolicy[];
    accounts: AWSAccount[];
    masterAccount: AWSAccount;

    constructor(reader: AwsOrganizationReader) {
        this.reader = reader;
    }

    startInitialize() {
        this.initializationPromise = this.initialize();
    }

    async initialize() {
        this.organization = await this.reader.organization.getValue();
        this.roots = await this.reader.roots.getValue();
        this.organizationalUnits = await this.reader.organizationalUnits.getValue();
        this.policies = await this.reader.policies.getValue();
        const accounts = await this.reader.accounts.getValue();

        this.masterAccount = accounts.find(x=>x.Id === this.organization.MasterAccountId);
        this.accounts = accounts.filter(x=>x.Id !== this.organization.MasterAccountId);
    }

    async endInitialize() {
        await this.initializationPromise;
    }
}