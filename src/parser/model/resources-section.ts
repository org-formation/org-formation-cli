import { IResource, IResources, TemplateRoot } from '../parser';
import { CloudFormationResource } from './cloudformation-resource';
import { CloudFormationStackResource } from './cloudformation-stack-resource';
import { MasterAccountResource } from './master-account-resource';
import { ResourceTypes } from './resource-types';

export class ResourcesSection {
    public rootAccount: MasterAccountResource;
    public readonly resources: CloudFormationResource[] = [];
    public readonly stacks: CloudFormationStackResource[] = [];
    private readonly root: TemplateRoot;
    private readonly contents: IResources;

    constructor(root: TemplateRoot, contents: IResources) {
        this.root = root;
        this.contents = contents;

        if (!this.contents) { return; }

        for (const id in this.contents) {
            const resource = this.createResource(id, this.contents[id]);
            this.resources.push(resource);
        }

        for (const resource of this.resources) {
            if (resource instanceof CloudFormationStackResource) {
                this.stacks.push(resource);
            }
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
            for (const account of resource.getNormalizedBoundAccounts()) {
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
            case ResourceTypes.StackResource:
                return new CloudFormationStackResource(this.root, id, resource);

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
