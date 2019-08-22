import { IResource, IResources, TemplateRoot } from '../parser';
import { CloudFormationResource } from './cloudformation-resource';
import { CloudFormationStackResource } from './cloudformation-stack-resource';
import { MasterAccountResource } from './master-account-resource';
export declare class ResourcesSection {
    rootAccount: MasterAccountResource;
    readonly resources: CloudFormationResource[];
    readonly stacks: CloudFormationStackResource[];
    private readonly root;
    private readonly contents;
    constructor(root: TemplateRoot, contents: IResources);
    resolveRefs(): void;
    enumTemplateTargets(): IResourceTarget[];
    createResource(id: string, resource: IResource): CloudFormationResource;
}
export interface IResourceTarget {
    region: string;
    accountLogicalId: string;
    resources: CloudFormationResource[];
    hash: string;
}
