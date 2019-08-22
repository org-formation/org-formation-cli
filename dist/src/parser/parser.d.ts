import { OrganizationSection } from './model/organization-section';
import { OrgResourceTypes, ResourceTypes } from './model/resource-types';
import { ResourcesSection } from './model/resources-section';
declare type TemplateVersion = '2010-09-09-OC';
export interface ITemplate {
    AWSTemplateFormatVersion: TemplateVersion;
    StackName?: string;
    Description?: string;
    Organization?: IOrganization;
    Metadata?: any;
    Parameters?: any;
    Mappings?: any;
    Conditions?: any;
    Resources?: IResources;
    Outputs?: any;
}
export interface IResources extends IResourcesMap {
}
export interface IOrganization extends IResourcesMap {
}
export interface IResourcesMap extends Record<string, IResource> {
}
export interface IResource {
    Type: OrgResourceTypes | ResourceTypes;
    Properties?: IPropertiesMap;
    OrganizationBindings?: IPropertiesMap;
}
export interface IPropertiesMap extends Record<string, any> {
}
export declare type IResourceRef = IResourceRefExpression | string;
export interface IResourceRefExpression {
    Ref: string;
}
export interface IOrganizationBindings {
    IncludeMasterAccount: boolean;
    Accounts: IResourceRef | IResourceRef[];
    OrganizationalUnits: IResourceRef | IResourceRef[];
    Regions: string | string[];
}
export declare class TemplateRoot {
    static create(path: string): TemplateRoot;
    static createFromContents(contents: string, dirname?: string): TemplateRoot;
    readonly contents: ITemplate;
    readonly dirname: string;
    readonly organizationSection: OrganizationSection;
    readonly resourcesSection: ResourcesSection;
    readonly stackName: string;
    readonly source: string;
    constructor(contents: ITemplate, dirname: string);
    clone(): TemplateRoot;
}
export {};
