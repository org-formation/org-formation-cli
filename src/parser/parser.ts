import * as fs from 'fs';
import md5 = require('md5');
import * as Path from 'path';
import { yamlParse } from 'yaml-cfn';
import { OrgFormationError } from '../org-formation-error';
import { OrganizationSection } from './model/organization-section';
import { OrgResourceTypes, ResourceTypes } from './model/resource-types';
import { ResourcesSection } from './model/resources-section';
import { Validator } from './validator';

type TemplateVersion  = '2010-09-09-OC';

export interface ITemplate {
    AWSTemplateFormatVersion: TemplateVersion;
    StackName?: string;
    Description?: string;
    Organization?: IOrganization;
    OrganizationBindings?: IOrganizationBinding;
    Metadata?: any;
    Parameters?: any;
    Mappings?: any;
    Conditions?: any;
    Resources?: IResources;
    Outputs?: any;
}

// tslint:disable-next-line: no-empty-interface
export interface IResources extends IResourcesMap {

}

// tslint:disable-next-line: no-empty-interface
export interface IOrganization extends IResourcesMap {

}

export interface IResourcesMap extends Record<string, IResource> {

}

export interface IResource {
    Type: OrgResourceTypes | ResourceTypes | string;
    Properties?: IPropertiesMap;
    OrganizationBindings?: IOrganizationBinding & IPropertiesMap;
    Foreach?: IOrganizationBinding & IPropertiesMap;
}

export interface IPropertiesMap extends Record<string, any> {

}

export type IResourceRef = IResourceRefExpression | string;

export interface IResourceRefExpression {
    Ref: string;
}

export interface IOrganizationBinding {
    IncludeMasterAccount?: boolean;
    Accounts?: IResourceRef | IResourceRef[];
    ExcludeAccounts?: IResourceRef | IResourceRef[];
    OrganizationalUnits?: IResourceRef | IResourceRef[];
    Regions?: string | string[];
    AccountsWithTag?: string;
}

export class TemplateRoot {
    public static create(path: string): TemplateRoot {
        try {
            const contents = fs.readFileSync(path).toString();
            const dirname = Path.dirname(path);
            return TemplateRoot.createFromContents(contents , dirname);
        } catch (err) {
            let reason = 'unknown';
            if (err && err.message) {
                reason = err.message;
            }
            throw new OrgFormationError(`unable to load file ${path}, reason: ${reason}`);
        }
    }

    public static createFromContents(contents: string, dirname: string = './'): TemplateRoot {
        if (contents === undefined) { throw new OrgFormationError('contents is undefined'); }
        if (contents.trim().length === 0) { throw new OrgFormationError('contents is empty'); }
        const organizationInclude = /Organization:\s*!Include\s*(\S*)/.exec(contents);
        let includedOrganization;
        let normalizedContentsForParser = contents;
        if (organizationInclude) {
            normalizedContentsForParser = normalizedContentsForParser.replace(organizationInclude[0], 'Organization:');
            const includePath = Path.join(dirname, organizationInclude[1]);
            const includeContents = fs.readFileSync(includePath).toString();
            const includedTemplate = yamlParse(includeContents) as ITemplate;
            includedOrganization = includedTemplate.Organization;
            if (!includedOrganization) {
                throw new OrgFormationError(`Organization include file (${includePath}) does not contain top level Organization.`);
            }
        }
        const obj = yamlParse(normalizedContentsForParser) as ITemplate;
        if (includedOrganization && !obj.Organization) {
            obj.Organization = includedOrganization;
        }
        return new TemplateRoot(obj, dirname);

    }

    public static createEmpty() {
        return new TemplateRoot({
            AWSTemplateFormatVersion : '2010-09-09-OC',
            Organization: {},
        }, './');
    }

    public readonly contents: ITemplate;
    public readonly dirname: string;
    public readonly organizationSection: OrganizationSection;
    public readonly resourcesSection: ResourcesSection;
    public readonly source: string;
    public readonly hash: string;

    constructor(contents: ITemplate, dirname: string) {
        if (!contents.AWSTemplateFormatVersion) {
            throw new OrgFormationError('AWSTemplateFormatVersion is missing');
        }
        if (contents.AWSTemplateFormatVersion !== '2010-09-09-OC') {
            throw new OrgFormationError(`Unexpected AWSTemplateFormatVersion version ${contents.AWSTemplateFormatVersion}, expected '2010-09-09-OC'`);
        }
        if (!contents.Organization) {
            throw new OrgFormationError('Top level Organization attribute is missing');
        }

        Validator.ThrowForUnknownAttribute(contents, 'template root',
                'AWSTemplateFormatVersion', 'Description', 'Organization', 'OrganizationBindings',
                'Metadata', 'Parameters', 'Mappings', 'Conditions', 'Resources', 'Outputs');

        this.contents = contents;
        this.dirname = dirname;
        this.source = JSON.stringify(contents);
        this.hash = md5(this.source);
        this.organizationSection = new OrganizationSection(this, contents.Organization);
        this.resourcesSection = new ResourcesSection(this, contents.Resources, contents.OrganizationBindings);

        this.organizationSection.resolveRefs();
        this.resourcesSection.resolveRefs();
    }
    public clone(): TemplateRoot {
        const clonedContents = JSON.parse(JSON.stringify(this.contents));
        return new TemplateRoot(clonedContents, this.dirname);
    }

}
