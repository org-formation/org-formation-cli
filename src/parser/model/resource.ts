import md5 = require("md5");
import { IResource, TemplateRoot } from "../parser";

export abstract class Resource {
    readonly logicalId: string;
    readonly type: string;
    protected readonly root: TemplateRoot;
    protected readonly resource: IResource;

    constructor(root: TemplateRoot, id: string, resource: IResource) {
        this.root = root;
        this.logicalId = id;
        this.resource = resource;
        this.type = resource.Type;
    }

    public calculateHash(): string {
        const s = JSON.stringify(this.resource, null, 2);
        return md5(s);
    }
}

export class UnknownResource extends Resource {

}

