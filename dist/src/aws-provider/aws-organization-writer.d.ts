import { Organizations } from 'aws-sdk/clients/all';
import { AccountResource } from '../parser/model/account-resource';
import { OrganizationalUnitResource } from '../parser/model/organizational-unit-resource';
import { ServiceControlPolicyResource } from '../parser/model/service-control-policy-resource';
import { AwsOrganization } from './aws-organization';
export declare class AwsOrganizationWriter {
    async: any;
    private organization;
    private organizationService;
    constructor(organizationService: Organizations, organization: AwsOrganization);
    ensureSCPEnabled(): Promise<void>;
    createPolicy(resource: ServiceControlPolicyResource): Promise<string>;
    attachPolicy(targetPhysicalId: string, policyPhysicalId: string): Promise<void>;
    detachPolicy(targetPhysicalId: string, policyPhysicalId: string): Promise<void>;
    updatePolicy(resource: ServiceControlPolicyResource, physicalId: string): Promise<void>;
    deletePolicy(physicalId: string): Promise<void>;
    attachAccount(parentPhysicalId: string, accountPhysicalId: string): Promise<void>;
    createOrganizationalUnit(resource: OrganizationalUnitResource): Promise<string>;
    updateOrganizationalUnit(resource: OrganizationalUnitResource, physicalId: string): Promise<void>;
    deleteOrganizationalUnit(physicalId: string): Promise<void>;
    createAccount(resource: AccountResource): Promise<string>;
    updateAccount(resource: AccountResource, accountId: string): Promise<void>;
    private _createAccount;
}
