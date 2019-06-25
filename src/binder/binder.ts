import { TemplateRoot } from "../parser/parser";
import { Resource } from "../parser/model/resource";
import { AccountResource } from "../parser/model/account-resource";
import { OrganizationalUnitResource } from "../parser/model/organizational-unit-resource";
import { ServiceControlPolicyResource } from "../parser/model/service-control-policy-resource";
import { PersistedState } from "../state/persisted-state";
import { ResourceTypes } from "../parser/model/resource-types";


export class Binder {
    private template: TemplateRoot;
    private state: PersistedState;

    constructor(template: TemplateRoot, state: PersistedState) {
        this.template = template;
        this.state = state;
    }

    getBindings(): BindingRoot {
        return  {
            organization: this.getOrganizationBindings()
        };
    }

    getOrganizationBindings(): OrganizationBinding {
        const policies = Array.from(ServiceControlPolicyBinding.enumerateServiceControlBindings(this.template, this.state));
        const organizationalUnits = Array.from(OrganizationalUnitBinding.enumerateOrganizationalUnitBindings(this.template, this.state));
        const accounts = Array.from(AccountBinding.enumerateAccountBindings(this.template, this.state));
        let masterAccount = Binding.getBinding<AccountResource>(this.state, this.template.organizationSection.masterAccount);

        return {
            policies,
            organizationalUnits,
            accounts,
            masterAccount
        };
    }
}

export class BindingRoot {
    organization: OrganizationBinding;
}

export class OrganizationBinding {
    policies: ServiceControlPolicyBinding[];
    organizationalUnits: OrganizationalUnitBinding[];
    accounts: AccountBinding[];
    masterAccount: AccountBinding;
}

type BindingAction = 'Create' | 'Update' | 'Delete' | 'None';

class Binding<TResource extends Resource> {
    template?: TResource;
    existingElementId?: string;
    action: BindingAction;

    protected static enumerateBindings<TResource extends Resource>(type: string, templateResources:TResource[], state: PersistedState): Binding<TResource>[] {
        const savedBindings = state.enumBindings(type);
        const result: Binding<TResource>[] = [];
        for(const templateResource of templateResources) {
            const binding = Binding.getBinding<TResource>(state, templateResource);
            result.push(binding);
        }

        for(const savedBinding of savedBindings) {
            if (!templateResources.find(x=>x.logicalId == savedBinding.logicalId)) {
                const binding: Binding<TResource> = {
                    action: 'Delete',
                    existingElementId: savedBinding.physicalId,
                }
                result.push(binding);
            }
        }
        return result;
    }

    public static getBinding<TResource extends Resource>(state: PersistedState, templateResource: TResource): Binding<TResource> {
        const savedBinding = state.getBinding(templateResource.type, templateResource.logicalId);
        const hash = templateResource.calculateHash();
        if (savedBinding === undefined) {
            return {
                action: 'Create',
                template: templateResource
            };
        }
        else if (hash != savedBinding.lastCommittedHash) {
            return {
                action: 'Update',
                template: templateResource,
                existingElementId: savedBinding.physicalId
            };
        }
        else {
            return {
                action: 'None',
                template: templateResource,
                existingElementId: savedBinding.physicalId
            };
        }
    }
}


class AccountBinding extends Binding<AccountResource> {

    static enumerateAccountBindings(template: TemplateRoot, state: PersistedState): AccountBinding[] {
        return Binding.enumerateBindings<AccountResource>(
                            ResourceTypes.Account,
                            template.organizationSection.accounts,
                            state);

    }
}



class OrganizationalUnitBinding extends Binding<OrganizationalUnitResource> {

    static enumerateOrganizationalUnitBindings(template: TemplateRoot, state: PersistedState): OrganizationalUnitBinding[] {
        return Binding.enumerateBindings<OrganizationalUnitResource>(
                            ResourceTypes.OrganizationalUnit,
                            template.organizationSection.organizationalUnits,
                            state);

    }
}


class ServiceControlPolicyBinding extends Binding<ServiceControlPolicyResource> {

    static enumerateServiceControlBindings(template: TemplateRoot, state: PersistedState): ServiceControlPolicyBinding[] {
        return Binding.enumerateBindings<ServiceControlPolicyResource>(
                            ResourceTypes.ServiceControlPolicy,
                            template.organizationSection.serviceControlPolicies,
                            state);

    }
}
