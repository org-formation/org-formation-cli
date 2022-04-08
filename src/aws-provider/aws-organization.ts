import { Organization } from 'aws-sdk/clients/organizations';
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

    public partitionOrganization: Organization | undefined;
    public partitionRoots: AWSRoot[];
    public partitionPolicies: AWSPolicy[];
    public partitionMasterAccount: AWSAccount | undefined;
    public partitionAccounts: AWSAccount[] | undefined;
    public partitionOrganizationalUnits: AWSOrganizationalUnit[] | undefined;

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

        const setPartitionOrgPromise = async (): Promise<void> => { this.partitionOrganization = await this.reader.organization.getPartitionValue(); };
        const setPartitionRootsPromise = async (): Promise<void> => { this.partitionRoots = await this.reader.roots.getPartitionValue(); };
        const setPartitionPolicies = async (): Promise<void> => { this.partitionPolicies = await this.reader.policies.getPartitionValue(); };
        const setPartitionAccounts = async (): Promise<void> => {
            const accounts = await this.reader.partitionAccounts.getValue();
            this.partitionMasterAccount = accounts.find(x => x.Id === this.partitionOrganization.MasterAccountId);
            this.partitionAccounts = accounts.filter(x => x.Id !== this.partitionOrganization.MasterAccountId);
            this.partitionOrganizationalUnits = await this.reader.organizationalUnits.getPartitionValue();
        };

        try {
            await Promise.all([setOrgPromise(), setRootsPromise(), setPolicies(), setAccounts(),
                setPartitionOrgPromise(), setPartitionRootsPromise(), setPartitionPolicies(), setPartitionAccounts()]);
        } catch (err) {
            throw err;
        }
    }

    public async endInitialize(): Promise<void> {
        await this.initializationPromise;
    }
}
