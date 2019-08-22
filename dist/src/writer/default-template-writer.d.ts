import { AwsOrganization } from '../aws-provider/aws-organization';
import { IAWSObject } from '../aws-provider/aws-organization-reader';
import { PersistedState } from '../state/persisted-state';
export declare class DefaultTemplateWriter {
    organizationModel: AwsOrganization;
    logicalNames: LogicalNames;
    constructor(organizationModel?: AwsOrganization);
    generateDefaultTemplate(): Promise<DefaultTemplate>;
    private generateResource;
    private generateSCP;
    private generateAccount;
    private generateOrganizationalUnit;
    private generateMasterAccount;
    private generateTemplateHeader;
}
export declare class DefaultTemplate {
    template: string;
    state: PersistedState;
}
declare class LogicalNames {
    names: Record<string, string>;
    takenNames: string[];
    getName(element: IAWSObject): string;
    private createName;
    private getPostFix;
    private getKey;
}
export {};
