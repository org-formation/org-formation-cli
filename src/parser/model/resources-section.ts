import { IOrganizationBinding, IResource, IResources, TemplateRoot } from '../parser';
import { CloudFormationResource } from './cloudformation-resource';

export class ResourcesSection {
    public readonly resources: CloudFormationResource[] = [];
    private readonly root: TemplateRoot;
    private readonly contents?: IResources;
    private readonly defaultBinding?: IOrganizationBinding;
    private readonly defaultRegion?: string | string[];

    constructor(root: TemplateRoot, contents?: IResources, defaultBinding?: IOrganizationBinding, defaultRegion?: string | string[]) {
        this.root = root;
        this.contents = contents;
        this.defaultBinding = defaultBinding;
        this.defaultRegion = defaultRegion;

        if (!this.contents) { return; }

        for (const id in this.contents) {
            const resource = this.createResource(id, this.contents[id]);
            this.resources.push(resource);
        }
    }

    public resolveRefs() {
        for (const resource of this.resources) {
            resource.resolveRefs();
        }
    }

    public enumTemplateTargets(): IResourceTarget[] {
        const map = new Map<string, IResourceTarget>();
        for (const resource of this.resources) {
            if (!resource.normalizedBoundAccounts) { continue; }
            for (const account of resource.normalizedBoundAccounts) {
                for (const region of resource.regions) {
                    const key = `${account}${region}`;
                    const current = map.get(key);
                    if (current === undefined) {
                        map.set(key, {
                            accountLogicalId: account,
                            region,
                            resources: [resource],
                        });
                    } else {
                        current.resources.push(resource);
                    }
                }
            }
        }
        return Array.from(map.values());
    }

    public createResource(id: string, resource: IResource): CloudFormationResource {
        switch (resource.Type) {
            default:
                return new CloudFormationResource(this.root, id, resource, this.defaultBinding, this.defaultRegion);
        }
    }
}

export interface IResourceTarget {
    region: string;
    accountLogicalId: string;
    resources: CloudFormationResource[];
}

export interface ICrossAccountResourceDependencies {
    Account: string;
    Ref: string;
}
