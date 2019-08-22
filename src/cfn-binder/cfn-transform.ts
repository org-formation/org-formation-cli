import { IResourceTarget } from '../parser/model/resources-section';
import { TemplateRoot } from '../parser/parser';
import { PersistedState } from '../state/persisted-state';

export class CfnTransform {
    private template: TemplateRoot;
    private state: PersistedState;

    constructor(template: TemplateRoot, state: PersistedState) {
        this.template = template;
        this.state = state;
    }

    public createTemplateForBinding(target: IResourceTarget): string {
        const resources: Record<string, any> = {};
        const resultingTemplate = {
            AWSTemplateFormatVersion: '2010-09-09',
            Description: this.template.contents.Description,
            Parameters: this.template.contents.Parameters,
            Metadata: this.template.contents.Metadata,
            Resources: resources,
            Mappings: this.template.contents.Mappings,
            Conditions: this.template.contents.Conditions,
            Outputs: this.template.contents.Outputs,

        };

        for (const resource of target.resources) {
            const resourceForTemplate = this.resolveOrganizationFunctions(resource.resourceForTemplate);
            resources[resource.logicalId] = resourceForTemplate;
        }

        for (const prop in resultingTemplate) {
            if (!resultingTemplate[prop]) {
                delete resultingTemplate[prop];
            }
        }
        return JSON.stringify(resultingTemplate, null, 2);
    }

    private resolveOrganizationFunctions(resource: any): any {
        if (resource !== null && typeof resource === 'object') {
            const entries = Object.entries(resource);
            if (entries.length === 1) {
                const [key, val]: [string, unknown] = entries[0];
                if (key === 'Ref') {
                    const orgResource = this.template.organizationSection.resources.find((x) => x.logicalId === val);
                    const binding = this.state.getBinding(orgResource.type, orgResource.logicalId);
                    return binding.physicalId;
                }
            }
            for (const [key, val] of entries) {
                if (val !== null && typeof val === 'object') {
                    resource[key] = this.resolveOrganizationFunctions(val);
                }
            }

        }
        return resource;
    }
}
