import { Organizations } from 'aws-sdk/clients/all';
import { Account, Organization, OrganizationalUnit, Policy, PolicyTargetSummary, Root } from 'aws-sdk/clients/organizations';
export declare type AWSObjectType = 'Account' | 'OrganizationalUnit' | 'Policy' | string;
interface IObjectWithParentId {
    ParentId: string;
}
export interface IAWSObject {
    Type: AWSObjectType;
    Id: string;
    Name: string;
}
interface IObjectWithAccounts {
    Accounts: AWSAccount[];
}
interface IObjectWithPolicies {
    Policies: AWSPolicy[];
}
interface IPolicyTargets {
    Targets: PolicyTargetSummary[];
}
export declare type AWSPolicy = Policy & IPolicyTargets & IAWSObject;
export declare type AWSAccount = Account & IObjectWithParentId & IObjectWithPolicies & IAWSObject;
export declare type AWSOrganizationalUnit = OrganizationalUnit & IObjectWithParentId & IObjectWithPolicies & IObjectWithAccounts & IAWSObject;
export declare type AWSRoot = Root & IObjectWithAccounts;
export declare class AwsOrganizationReader {
    private static getOrganization;
    private static listPolicies;
    private static listRoots;
    private static listOrganizationalUnits;
    private static listAccounts;
    readonly policies: Lazy<AWSPolicy[]>;
    readonly accounts: Lazy<AWSAccount[]>;
    readonly organizationalUnits: Lazy<AWSOrganizationalUnit[]>;
    readonly organization: Lazy<Organization>;
    readonly roots: Lazy<Root[]>;
    private readonly organizationService;
    constructor(organizationService: Organizations);
}
declare class Lazy<T> {
    private cachedValue;
    private valueTimestamp;
    private obtainValueFn;
    private that;
    constructor(that: AwsOrganizationReader, obtainValueFn: (that: AwsOrganizationReader) => Promise<T>);
    getValue(since?: Date): Promise<T>;
}
export {};
