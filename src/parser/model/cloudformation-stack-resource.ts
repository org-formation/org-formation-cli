import { readFileSync } from 'fs';
import md5 = require('md5');
import * as Path from 'path';
import { IResource, TemplateRoot } from '../parser';
import { CloudFormationResource } from './cloudformation-resource';
import { Resource } from './resource';

export interface IStackProperties {
    TemplateURL: string;
}

export class CloudFormationStackResource extends CloudFormationResource {
    public templateUrl: string;
    public templateContents: string;
    public templateHash: string;
    public templateUnresolvable = false;
    private props: IStackProperties;

    constructor(root: TemplateRoot, id: string, resource: IResource) {
        super(root, id, resource);

        this.props = resource.Properties as IStackProperties;
        this.templateUrl = this.props.TemplateURL;
        if (!Path.isAbsolute(this.templateUrl)) {
            this.templateUrl = Path.resolve(root.dirname, this.templateUrl);
        }
        try {
            this.templateContents = readFileSync(this.templateUrl).toString('utf-8');
            this.templateHash = md5(this.templateContents);
        } catch (err) {
            if (err && err.code === 'ENOENT') {
                this.templateUnresolvable = true;
                this.templateHash = 'unresolvable';
            } else {
                throw err;
            }
        }
    }

    public calculateHash() {
        return this.resourceHash + '/' + this.templateHash;
    }
}
