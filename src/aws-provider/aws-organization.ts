import { Organization } from 'aws-sdk/clients/organizations';
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

    public startInitialize(): void{
        this.initializationPromise = this.initialize();
    }

    public async initialize(): Promise<void> {
        const setOrgPromise = async (): Promise<void> => { this.organization = await this.reader.organization.getValue(); };
        const setRootsPromise = async (): Promise<void> => { this.roots = await this.reader.roots.getValue(); };
        const setPolicies = async (): Promise<void> => { this.policies = await this.reader.policies.getValue(); };
        const setAccounts = async (): Promise<void> => {
            const accounts = await this.reader.accounts.getValue();
            this.masterAccount = accounts.find(x => x.Id === this.organization.MasterAccountId);
            this.accounts = accounts.filter(x => x.Id !== this.organization.MasterAccountId);
            this.organizationalUnits = await this.reader.organizationalUnits.getValue();
        };

        try {
            await Promise.all([setOrgPromise(), setRootsPromise(), setPolicies(), setAccounts()]);
        } catch (err) {
            throw err;
        }

        if (this.reader.hasMasterInOrganizationUnit(this.organization.MasterAccountId)) {
            throw new OrgFormationError('This is not supported yet, apologies.');
        }
    }

    public async endInitialize(): Promise<void> {
        await this.initializationPromise;
    }
}
