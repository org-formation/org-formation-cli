import { IResourceTarget } from '../parser/model/resources-section';
import { TemplateRoot } from '../parser/parser';
import { PersistedState } from '../state/persisted-state';
export declare class CfnTransform {
    private template;
    private state;
    constructor(template: TemplateRoot, state: PersistedState);
    createTemplateForBinding(target: IResourceTarget): string;
    private resolveOrganizationFunctions;
}
