import { IResource, IResources, TemplateRoot } from '../parser';
import { CloudFormationResource } from './cloudformation-resource';

export class ResourcesSection {
    public readonly resources: CloudFormationResource[] = [];
    private readonly root: TemplateRoot;
    private readonly contents?: IResources;

    constructor(root: TemplateRoot, contents?: IResources) {
        this.root = root;
        this.contents = contents;

        if (!this.contents) { return; }

        for (const id in this.contents) {
            const resource = this.createResource(id, this.contents[id]);
            this.resources.push(resource);
        }
    }

    public resolveRefs(): void {
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
                return new CloudFormationResource(this.root, id, resource);
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
