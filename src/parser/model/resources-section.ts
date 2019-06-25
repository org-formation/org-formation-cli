import { IResource, IResources, TemplateRoot } from '../parser';
import { CloudFormationStackResource } from './cloudformation-stack-resource';
import { MasterAccountResource } from './master-account-resource';
import { Resource, UnknownResource } from './resource';

export class ResourcesSection {
    public rootAccount: MasterAccountResource;
    public readonly resources: Resource[] = [];
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

    public createResource(id: string, resource: IResource): Resource {
        switch (resource.Type) {
            case 'AWS::CloudFormation::Stack':
                return new MasterAccountResource(this.root, id, resource);

            default:
                return new UnknownResource(this.root, id, resource);
        }
    }
}
