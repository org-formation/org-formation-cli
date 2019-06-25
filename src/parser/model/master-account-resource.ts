import { IResource, IResourceRef, TemplateRoot } from '../parser';
import { Resource } from './resource';

export interface IMasterAccountProperties {
    RootEmail: string;
    AccountName: string;
    OrganizationDeploymentBucket: string;
    ServiceControlPolicies: IResourceRef | IResourceRef[];
}

export class MasterAccountResource extends Resource {
    public rootEmail: string;
    public accountName: string;
    public deploymentBucketName: string;
    public serviceControlPolicies: IResourceRef[];

    constructor(root: TemplateRoot, id: string, resource: IResource) {
        super(root, id, resource);
        const props = this.resource.Properties as IMasterAccountProperties;

        this.rootEmail = props.RootEmail;
        this.accountName = props.AccountName;
        this.deploymentBucketName = props.OrganizationDeploymentBucket;
        this.serviceControlPolicies = ToArray(props.ServiceControlPolicies);
    }
}

function ToArray(val: IResourceRef | IResourceRef[]): IResourceRef[] {
    if (!val) {
        return [];
    } else if (!Array.isArray(val)) {
        return [val];
    } else {
        return val;
    }
}
