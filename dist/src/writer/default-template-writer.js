"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const all_1 = require("aws-sdk/clients/all");
const Yaml = __importStar(require("yamljs"));
const aws_organization_1 = require("../aws-provider/aws-organization");
const aws_organization_reader_1 = require("../aws-provider/aws-organization-reader");
const resource_types_1 = require("../parser/model/resource-types");
const parser_1 = require("../parser/parser");
const persisted_state_1 = require("../state/persisted-state");
class DefaultTemplateWriter {
    constructor(organizationModel) {
        if (organizationModel) {
            this.organizationModel = organizationModel;
        }
        else {
            const org = new all_1.Organizations({ region: 'us-east-1' });
            const reader = new aws_organization_reader_1.AwsOrganizationReader(org);
            this.organizationModel = new aws_organization_1.AwsOrganization(reader);
        }
        this.logicalNames = new LogicalNames();
    }
    async generateDefaultTemplate() {
        await this.organizationModel.initialize();
        const bindings = [];
        const state = persisted_state_1.PersistedState.CreateEmpty(this.organizationModel.masterAccount.Id);
        const lines = [];
        this.generateTemplateHeader(lines, this.organizationModel.organization);
        const result = this.generateMasterAccount(lines, this.organizationModel.masterAccount);
        bindings.push({
            type: result.type,
            logicalId: result.logicalName,
            physicalId: this.organizationModel.masterAccount.Id,
            lastCommittedHash: '',
        });
        for (const organizationalUnit of this.organizationModel.organizationalUnits) {
            const result = this.generateOrganizationalUnit(lines, organizationalUnit);
            bindings.push({
                type: result.type,
                logicalId: result.logicalName,
                physicalId: organizationalUnit.Id,
                lastCommittedHash: '',
            });
        }
        for (const account of this.organizationModel.accounts) {
            const result = this.generateAccount(lines, account);
            bindings.push({
                type: result.type,
                logicalId: result.logicalName,
                physicalId: account.Id,
                lastCommittedHash: '',
            });
        }
        for (const scp of this.organizationModel.policies) {
            if (scp.PolicySummary.AwsManaged) {
                continue;
            }
            const result = this.generateSCP(lines, scp);
            bindings.push({
                type: result.type,
                logicalId: result.logicalName,
                physicalId: scp.Id,
                lastCommittedHash: '',
            });
        }
        this.generateResource(lines);
        const template = lines.map((x) => x.toString()).join('');
        const templateRoot = parser_1.TemplateRoot.createFromContents(template);
        for (const binding of bindings) {
            let foundResource;
            switch (binding.type) {
                case resource_types_1.OrgResourceTypes.MasterAccount:
                    foundResource = templateRoot.organizationSection.masterAccount;
                    break;
                case resource_types_1.OrgResourceTypes.Account:
                    foundResource = templateRoot.organizationSection.accounts.find((x) => x.logicalId === binding.logicalId);
                    break;
                case resource_types_1.OrgResourceTypes.OrganizationalUnit:
                    foundResource = templateRoot.organizationSection.organizationalUnits.find((x) => x.logicalId === binding.logicalId);
                    break;
                case resource_types_1.OrgResourceTypes.ServiceControlPolicy:
                    foundResource = templateRoot.organizationSection.serviceControlPolicies.find((x) => x.logicalId === binding.logicalId);
                    break;
            }
            binding.lastCommittedHash = foundResource.calculateHash();
            state.setBinding(binding);
        }
        return {
            template,
            state,
        };
    }
    generateResource(lines) {
        // lines.push(new Line('Resources', '', 0));
        // lines.push(new EmptyLine());
        // lines.push(new CommentedLine('IamBaseLine', '', 2));
        // lines.push(new CommentedLine('Type', 'AWS::CloudFormation::Stack', 4));
        // lines.push(new CommentedLine('OrganizationBindings', '', 4));
        // lines.push(new CommentedLine('Regions', 'eu-central-1', 6));
        // lines.push(new CommentedLine('Accounts', '*', 6));
        // lines.push(new CommentedLine('IncludeMasterAccount', 'false', 6));
        // lines.push(new CommentedLine('Properties', '', 4));
        // lines.push(new CommentedLine('TemplateURL', './example.iam.baseline.yml', 6));
        // lines.push(new CommentedLine('Parameters', '', 6));
        // lines.push(new CommentedLine('UsersAccount', '!Ref UsersAccount', 8));
        lines.push(new EmptyLine());
    }
    generateSCP(lines, policy) {
        const logicalName = this.logicalNames.getName(policy);
        lines.push(new Line(logicalName, '', 2));
        lines.push(new Line('Type', resource_types_1.OrgResourceTypes.ServiceControlPolicy, 4));
        lines.push(new Line('Properties', '', 4));
        lines.push(new Line('PolicyName', policy.Name, 6));
        lines.push(new Line('Description', policy.PolicySummary.Description, 6));
        lines.push(new ObjLine('PolicyDocument', JSON.parse(policy.Content), 6));
        lines.push(new EmptyLine());
        return {
            type: resource_types_1.OrgResourceTypes.ServiceControlPolicy,
            logicalName,
        };
    }
    generateAccount(lines, account) {
        const logicalName = this.logicalNames.getName(account);
        const policiesList = account.Policies.filter((x) => !x.PolicySummary.AwsManaged).map((x) => '!Ref ' + this.logicalNames.getName(x));
        lines.push(new Line(logicalName, '', 2));
        lines.push(new Line('Type', resource_types_1.OrgResourceTypes.Account, 4));
        lines.push(new Line('Properties', '', 4));
        lines.push(new Line('AccountName', account.Name, 6));
        lines.push(new Line('AccountId', account.Id, 6));
        lines.push(new Line('RootEmail', account.Email, 6));
        lines.push(new ListLine('ServiceControlPolicies', policiesList, 6));
        lines.push(new EmptyLine());
        return {
            type: resource_types_1.OrgResourceTypes.Account,
            logicalName,
        };
    }
    generateOrganizationalUnit(lines, organizationalUnit) {
        const logicalName = this.logicalNames.getName(organizationalUnit);
        const policiesList = organizationalUnit.Policies.filter((x) => !x.PolicySummary.AwsManaged).map((x) => '!Ref ' + this.logicalNames.getName(x));
        const accountList = organizationalUnit.Accounts.map((x) => '!Ref ' + this.logicalNames.getName(x));
        lines.push(new Line(logicalName, '', 2));
        lines.push(new Line('Type', resource_types_1.OrgResourceTypes.OrganizationalUnit, 4));
        lines.push(new Line('Properties', '', 4));
        lines.push(new Line('OrganizationalUnitName', organizationalUnit.Name, 6));
        lines.push(new ListLine('ServiceControlPolicies', policiesList, 6));
        lines.push(new ListLine('Accounts', accountList, 6));
        lines.push(new EmptyLine());
        return {
            type: resource_types_1.OrgResourceTypes.OrganizationalUnit,
            logicalName,
        };
    }
    generateMasterAccount(lines, masterAccount) {
        const policiesList = masterAccount.Policies.map((x) => '!Ref ' + this.logicalNames.getName(x));
        lines.push(new Line('Organization', '', 0));
        lines.push(new Line('MasterAccount', '', 2));
        lines.push(new Line('Type', resource_types_1.OrgResourceTypes.MasterAccount, 4));
        lines.push(new Line('Properties', '', 4));
        lines.push(new Line('AccountName', masterAccount.Name, 6));
        lines.push(new Line('AccountId', masterAccount.Id, 6));
        lines.push(new ListLine('ServiceControlPolicies', policiesList, 6));
        lines.push(new EmptyLine());
        return {
            type: resource_types_1.OrgResourceTypes.MasterAccount,
            logicalName: 'MasterAccount',
        };
    }
    generateTemplateHeader(lines, organization) {
        lines.push(new Line('AWSTemplateFormatVersion', '2010-09-09-OC', 0));
        lines.push(new Line('Description', `default template generated for organization with master account ${organization.MasterAccountId}`, 0));
        lines.push(new EmptyLine());
    }
}
exports.DefaultTemplateWriter = DefaultTemplateWriter;
class DefaultTemplate {
}
exports.DefaultTemplate = DefaultTemplate;
class LogicalNames {
    constructor() {
        this.names = {};
        this.takenNames = [];
    }
    getName(element) {
        const key = this.getKey(element);
        let name = this.names[key];
        if (!name) {
            this.names[key] = name = this.createName(element);
        }
        return name;
    }
    createName(element) {
        let name = element.Name;
        let postFix = this.getPostFix(element);
        name = name.replace(/ /g, '');
        name = name[0].toUpperCase() + name.substring(1);
        if (name.endsWith(postFix)) {
            postFix = '';
        }
        name = name + postFix;
        let result = name;
        let i = 2;
        while (this.takenNames.includes(result)) {
            result = name + i;
            i++;
        }
        return result;
    }
    getPostFix(element) {
        switch (element.Type) {
            case 'Account':
                return 'Account';
            case 'OrganizationalUnit':
                return 'OU';
            case 'Policy':
                return 'SCP';
        }
    }
    getKey(element) {
        return element.Type + element.Id;
    }
}
class EmptyLine {
    toString() {
        return '\n';
    }
}
class ObjLine {
    constructor(label, value, indentation) {
        this.label = label;
        this.value = value;
        this.indentation = indentation;
    }
    toString() {
        const indentation = ''.padStart(this.indentation, ' ');
        const line = `${indentation}${this.label}:\n`;
        const value = Yaml.stringify(this.value, 10, 2);
        const formatted = value.split('\n').map((part) => `${indentation}  ${part}`).join('\n');
        return line + formatted;
    }
}
class Line {
    constructor(label, value, indentation) {
        this.label = label;
        this.value = value;
        this.indentation = indentation;
    }
    toString() {
        let val = this.value;
        if (val === '*') {
            val = '\'' + val + '\'';
        }
        if ('0987654321'.includes(val[0])) {
            val = '\'' + val + '\'';
        }
        const indentation = ''.padStart(this.indentation, ' ');
        const line = `${indentation}${this.label}: ${val}`;
        return line.trimRight() + '\n';
    }
}
class CommentedLine extends Line {
    constructor(label, value, indentation) {
        super(label, value, indentation);
    }
    toString() {
        return '#' + super.toString();
    }
}
class ListLine {
    constructor(label, values, indentation) {
        this.label = label;
        this.values = values;
        this.indentation = indentation;
    }
    toString() {
        if (this.values.length === 0) {
            return '';
        }
        if (this.values.length === 1) {
            return new Line(this.label, this.values[0], this.indentation).toString();
        }
        const indentation = ''.padStart(this.indentation, ' ');
        const line = `${indentation}${this.label}:\n`;
        const values = this.values.map((x) => `${indentation}  - ${x}`).join('\n');
        return line + values + '\n';
    }
}
//# sourceMappingURL=default-template-writer.js.map