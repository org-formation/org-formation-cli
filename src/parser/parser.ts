import { yamlParse } from 'yaml-cfn';
import * as fs from 'fs';
import * as Path from 'path';
import { OrganizationSection } from './model/organization-section';
import { ResourcesSection } from './model/resources-section';

export interface ITemplate {
    AWSTemplateFormatVersion: string;
    Description?: string;
    Organization?: IOrganization;
    Metadata?: any;
    Parameters?: any;
    Mappings?: any;
    Conditions?: any;
    Resources?: IResources;
    Outputs?: any;
    CrossAccountPermissions?: any;
}

export interface IResources extends IResourcesMap {

}

export interface IOrganization extends IResourcesMap {

}

export interface IResourcesMap extends Record<string, IResource> {

}

export interface IResource {
    Type: string;
    Properties?: IPropertiesMap;
    OrganizationBindings?: IPropertiesMap;
}

export interface IPropertiesMap extends Record<string, any> {

}

export interface IResourceRef {
    Ref : string
}

export interface IOrganizationBindings {
    IncludeMasterAccount: boolean;
    Accounts: IResourceRef | IResourceRef[] | '*';
    OrganizationalUnits: IResourceRef | IResourceRef[] | '*';
    Regions: string | string[]
}

export class TemplateRoot {
    readonly contents: ITemplate;
    readonly dirname: string;
    readonly organizationSection: OrganizationSection;
    readonly resourcesSection: ResourcesSection;

    constructor(contents: ITemplate, dirname: string) {
        this.contents = contents;
        this.dirname = dirname;
        this.organizationSection = new OrganizationSection(this, contents.Organization);
        this.resourcesSection = new ResourcesSection(this, contents.Resources);
    }
    public clone(): TemplateRoot {
        const clonedContents = JSON.parse(JSON.stringify(this.contents));
        return new TemplateRoot(clonedContents, this.dirname);
    }
    static create(path: string): TemplateRoot {
        const contents = fs.readFileSync(path).toString();
        const obj = yamlParse(contents) as ITemplate;
        const dirname = Path.dirname(path);
        return new TemplateRoot(obj, dirname);
    }

    static createFromContents(contents: string): TemplateRoot {
        const obj = yamlParse(contents) as ITemplate;
        return new TemplateRoot(obj, './');
    }

}
