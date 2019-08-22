import { Organization, Root } from 'aws-sdk/clients/organizations';
import { AWSAccount, AWSOrganizationalUnit, AwsOrganizationReader, AWSPolicy } from './aws-organization-reader';
export declare class AwsOrganization {
    organization: Organization;
    roots: Root[];
    organizationalUnits: AWSOrganizationalUnit[];
    policies: AWSPolicy[];
    accounts: AWSAccount[];
    masterAccount: AWSAccount;
    private readonly reader;
    private initializationPromise;
    constructor(reader: AwsOrganizationReader);
    startInitialize(): void;
    initialize(): Promise<void>;
    endInitialize(): Promise<void>;
}
