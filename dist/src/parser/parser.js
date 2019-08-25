"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const Path = __importStar(require("path"));
const yaml_cfn_1 = require("yaml-cfn");
const organization_section_1 = require("./model/organization-section");
const resources_section_1 = require("./model/resources-section");
const validator_1 = require("./validator");
class TemplateRoot {
    static create(path) {
        try {
            const contents = fs.readFileSync(path).toString();
            const dirname = Path.dirname(path);
            return TemplateRoot.createFromContents(contents, dirname);
        }
        catch (err) {
            let reason = 'unknown';
            if (err && err.message) {
                reason = err.message;
            }
            throw new Error(`unable to load file ${path}, reason: ${reason}`);
        }
    }
    static createFromContents(contents, dirname = './') {
        if (contents === undefined) {
            throw new Error('contents is undefined');
        }
        if (contents.trim().length === 0) {
            throw new Error('contents is empty');
        }
        const organizationInclude = /Organization:\s*!Include\s*(\S*)/.exec(contents);
        let includedOrganization;
        let normalizedContentsForParser = contents;
        if (organizationInclude) {
            normalizedContentsForParser = normalizedContentsForParser.replace(organizationInclude[0], 'Organization:');
            const includePath = Path.join(dirname, organizationInclude[1]);
            const includeContents = fs.readFileSync(includePath).toString();
            const includedTemplate = yaml_cfn_1.yamlParse(includeContents);
            includedOrganization = includedTemplate.Organization;
            if (!includedOrganization) {
                throw new Error(`Organization include file (${includePath}) does not contain top level Organization.`);
            }
        }
        const obj = yaml_cfn_1.yamlParse(normalizedContentsForParser);
        if (includedOrganization && !obj.Organization) {
            obj.Organization = includedOrganization;
        }
        return new TemplateRoot(obj, dirname);
    }
    static createEmpty() {
        return new TemplateRoot({
            AWSTemplateFormatVersion: '2010-09-09-OC',
            Organization: {},
        }, './');
    }
    constructor(contents, dirname) {
        if (!contents.AWSTemplateFormatVersion) {
            throw new Error('AWSTemplateFormatVersion is missing');
        }
        if (contents.AWSTemplateFormatVersion !== '2010-09-09-OC') {
            throw new Error(`Unexpected AWSTemplateFormatVersion version ${contents.AWSTemplateFormatVersion}, expected '2010-09-09-OC'`);
        }
        if (!contents.Organization) {
            throw new Error('Top level Organization attribute is missing');
        }
        validator_1.Validator.ThrowForUnknownAttribute(contents, 'template root', 'AWSTemplateFormatVersion', 'StackName', 'Description', 'Organization', 'Metadata', 'Parameters', 'Mappings', 'Conditions', 'Resources', 'Outputs');
        this.contents = contents;
        this.dirname = dirname;
        this.source = JSON.stringify(contents);
        this.organizationSection = new organization_section_1.OrganizationSection(this, contents.Organization);
        this.resourcesSection = new resources_section_1.ResourcesSection(this, contents.Resources);
        this.stackName = (contents.StackName) ? contents.StackName : 'organization-formation';
        this.organizationSection.resolveRefs();
        this.resourcesSection.resolveRefs();
    }
    clone() {
        const clonedContents = JSON.parse(JSON.stringify(this.contents));
        return new TemplateRoot(clonedContents, this.dirname);
    }
}
exports.TemplateRoot = TemplateRoot;
//# sourceMappingURL=parser.js.map