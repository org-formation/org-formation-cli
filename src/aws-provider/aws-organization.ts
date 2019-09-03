import { Organization, PolicySummary, Root } from 'aws-sdk/clients/organizations';
import { OrgFormationError } from '../org-formation-error';
import { AWSAccount, AWSOrganizationalUnit, AwsOrganizationReader, AWSPolicy, AWSRoot } from './aws-organization-reader';

export class AwsOrganization {

    public organization: Organization;
    public roots: AWSRoot[];
    public organizationalUnits: AWSOrganizationalUnit[];
    public policies: AWSPolicy[];
    public accounts: AWSAccount[];
    public masterAccount: AWSAccount;
    private readonly reader: AwsOrganizationReader;
    private initializationPromise: Promise<void>;

    constructor(reader: AwsOrganizationReader) {
        this.reader = reader;
    }

    public startInitialize() {
        this.initializationPromise = this.initialize();
    }

    public async initialize() {
        const setOrgPromise = async () => { this.organization = await this.reader.organization.getValue(); };
        const setRootsPromise = async () => { this.roots = await this.reader.roots.getValue(); };
        const setPolicies = async () => { this.policies = await this.reader.policies.getValue(); };
        const setAccounts = async () => {
            const accounts = await this.reader.accounts.getValue();
            this.masterAccount = accounts.find((x) => x.Id === this.organization.MasterAccountId);
            this.accounts = accounts.filter((x) => x.Id !== this.organization.MasterAccountId);
            this.organizationalUnits = await this.reader.organizationalUnits.getValue();
        };
        try {
            await Promise.all([setOrgPromise(), setRootsPromise(), setPolicies(), setAccounts()]);
        } catch (err) {
            throw err;
        }
    }

    public async endInitialize() {
        await this.initializationPromise;
    }
}
