import { IOrganization, IResource, TemplateRoot } from '../parser';
import { AccountResource } from './account-resource';
import { MasterAccountResource } from './master-account-resource';
import { OrganizationRootResource } from './organization-root-resource';
import { OrganizationalUnitResource } from './organizational-unit-resource';
import { Resource } from './resource';
import { OrgResourceTypes } from './resource-types';
import { ServiceControlPolicyResource } from './service-control-policy-resource';

export class OrganizationSection {
    public readonly root: TemplateRoot;
    public readonly contents: IOrganization;
    public masterAccount: MasterAccountResource;
    public organizationRoot: OrganizationRootResource;
    public readonly resources: Resource[] = [];
    public readonly accounts: AccountResource[] = [];
    public readonly organizationalUnits: OrganizationalUnitResource[] = [];
    public readonly serviceControlPolicies: ServiceControlPolicyResource[] = [];

    constructor(root: TemplateRoot, contents: IOrganization) {
        this.root = root;
        this.contents = contents;

        if (!this.contents) {
            return;
        }

        for (const id in this.contents)  {
            const resource = this.createResource(id, this.contents[id]);
            this.resources.push(resource);
        }

        for (const resource of this.resources) {
            if (resource instanceof MasterAccountResource) {
                if (this.masterAccount) {
                    throw new Error(`organization section cannot have multiple master account resources`);
                }
                this.masterAccount = resource;
            } else if (resource instanceof OrganizationRootResource) {
                if (this.organizationRoot) {
                    throw new Error(`organization section cannot have multiple organization roots`);
                }
                this.organizationRoot = resource;
            } else if (resource instanceof AccountResource) {
                this.accounts.push(resource);
            } else if (resource instanceof OrganizationalUnitResource) {
                this.organizationalUnits.push(resource);
            } else if (resource instanceof ServiceControlPolicyResource) {
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

    public resolveRefs() {
        for (const resource of this.resources) {
            try {
                resource.resolveRefs();
            } catch (err) { // todo: move one level up!
                let reason = 'unknown';
                if (err && err.message) {
                    reason = err.message;
                }
                throw new Error(`unable to load references for organizational resource ${resource.logicalId}, reason: ${reason}`);
            }
        }
    }

    public createResource(id: string, resource: IResource): Resource {
        switch (resource.Type) {
            case OrgResourceTypes.MasterAccount:
                return new MasterAccountResource(this.root, id, resource);

            case OrgResourceTypes.OrganizationRoot:
                return new OrganizationRootResource(this.root, id, resource);

            case OrgResourceTypes.Account:
                return new AccountResource(this.root, id, resource);

            case OrgResourceTypes.OrganizationalUnit:
                return new OrganizationalUnitResource(this.root, id, resource);

            case OrgResourceTypes.ServiceControlPolicy:
                return new ServiceControlPolicyResource(this.root, id, resource);

            default:
                if (resource.Type === undefined) {
                    throw new Error(`unexpected attribute ${id} found in Organization section`);
                }
                throw new Error(`attribute ${id} has unknown type ${resource.Type}`);
        }
    }

    private throwForDuplicateVale(arr: string[], fnError: (val: string) => Error) {
        const sortedArr = arr.sort();
        for (let i = 0; i < sortedArr.length - 1; i++) {
            if (sortedArr[i + 1] === sortedArr[i]) {
                const duplicate = sortedArr[i];
                throw fnError(duplicate);
            }
        }
    }

}
