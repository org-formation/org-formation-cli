import { DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS } from './aws-util';
import { PersistedState } from '~state/persisted-state';
import { TemplateRoot } from '~parser/parser';

export class GlobalState {
    public static State: PersistedState;
    public static OrganizationTemplate: TemplateRoot;

    public static Init(state: PersistedState, organizationTemplate: TemplateRoot): void {
        this.State = state;
        this.OrganizationTemplate = organizationTemplate;
    }

    public static GetCrossAccountRoleName(accountId: string): string {
        if (this.State === undefined || this.OrganizationTemplate === undefined) {
            return DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS.RoleName;
        }

        const logicalId = this.State.getLogicalIdForPhysicalId(accountId);
        let account = this.OrganizationTemplate.organizationSection.findAccount(x=>x.logicalId === logicalId);
        if (account === undefined) {
            account = this.OrganizationTemplate.organizationSection.findAccount(x=>x.accountId === accountId);
            if (account === undefined) {
                const organizationRootDefaultRole = this.OrganizationTemplate.organizationSection.organizationRoot?.defaultOrganizationAccessRoleName;
                if (!organizationRootDefaultRole) {
                    return DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS.RoleName;
                }
                return organizationRootDefaultRole;
            }
        }
        return account.organizationAccessRoleName;
    }
}
