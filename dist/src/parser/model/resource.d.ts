import { IResource, IResourceRef, TemplateRoot } from '../parser';
export interface Reference<TResource extends Resource> {
    PhysicalId?: string;
    TemplateResource?: TResource;
}
export declare abstract class Resource {
    readonly logicalId: string;
    readonly type: string;
    protected readonly root: TemplateRoot;
    protected readonly resource: IResource;
    constructor(root: TemplateRoot, id: string, resource: IResource);
    calculateHash(): string;
    resolveRefs(): void;
    protected throwForUnknownAttributes(obj: any, id: string, ...knownAttributes: string[]): void;
    protected resolve<T extends Resource>(val: IResourceRef | IResourceRef[], list: T[]): Array<Reference<T>>;
}
