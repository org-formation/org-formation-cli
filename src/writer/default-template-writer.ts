import { AwsOrganization } from "../aws-provider/aws-organization";
import { AwsOrganizationReader, AWSAccount, AWSOrganizationalUnit, AWSPolicy, AWSObject } from "../aws-provider/aws-organization-reader";
import { Organizations } from "aws-sdk/clients/all";
import { Organization } from "aws-sdk/clients/organizations";
import * as Yaml from "yamljs";
import { PersistedState, IBinding } from "../state/persisted-state";
import { TemplateRoot } from "../parser/parser";
import { ResourceTypes } from "../parser/model/resource-types";
import { Resource } from "../parser/model/resource";

export class DefaultTemplateWriter {
    organizationModel: AwsOrganization;
    logicalNames: LogicalNames;

    constructor(organizationModel?: AwsOrganization) {
        if (organizationModel) {
            this.organizationModel = organizationModel;
        } else {
            const org = new Organizations({region: 'us-east-1'});
            const reader = new AwsOrganizationReader(org);
            this.organizationModel = new AwsOrganization(reader);
        }
        this.logicalNames = new LogicalNames();
    }

    async generateDefaultTemplate(): Promise<DefaultTemplate> {
        await this.organizationModel.initialize();
        const bindings: IBinding[] = [];
        const state = PersistedState.CreateEmpty(this.organizationModel.masterAccount.Id);
        const lines: YamlLine[] = [];
        this.generateTemplateHeader(lines, this.organizationModel.organization)

        const result = this.generateMasterAccount(lines, this.organizationModel.masterAccount);

        bindings.push({
            type: result.type,
            logicalId: result.logicalName,
            physicalId: this.organizationModel.masterAccount.Id,
            lastCommittedHash: '',
        })

        for(const organizationalUnit of this.organizationModel.organizationalUnits) {
            const result = this.generateOrganizationalUnit(lines, organizationalUnit);

            bindings.push({
                type: result.type,
                logicalId: result.logicalName,
                physicalId: organizationalUnit.Id,
                lastCommittedHash: '',
            })
        }
        for(const account of this.organizationModel.accounts) {
            const result = this.generateAccount(lines, account);

            bindings.push({
                type: result.type,
                logicalId: result.logicalName,
                physicalId: account.Id,
                lastCommittedHash: '',
            })
        }
        for(const scp of this.organizationModel.policies) {
            if (scp.PolicySummary.AwsManaged) continue;
            const result = this.generateSCP(lines, scp, );

            bindings.push({
                type: result.type,
                logicalId: result.logicalName,
                physicalId: scp.Id,
                lastCommittedHash: '',
            })
        }

        this.generateResource(lines);

        const template = lines.map(x=>x.toString()).join('');
        const templateRoot = TemplateRoot.createFromContents(template);

        for(const binding of bindings) {
            let foundResource: Resource = undefined;
            switch(binding.type) {
                case ResourceTypes.MasterAccount:
                    foundResource = templateRoot.organizationSection.masterAccount;
                break;
                case ResourceTypes.Account:
                    foundResource = templateRoot.organizationSection.accounts.find(x=>x.logicalId == binding.logicalId);
                break;
                case ResourceTypes.OrganizationalUnit:
                    foundResource = templateRoot.organizationSection.organizationalUnits.find(x=>x.logicalId == binding.logicalId);
                break;
                case ResourceTypes.ServiceControlPolicy:
                    foundResource = templateRoot.organizationSection.serviceControlPolicies.find(x=>x.logicalId == binding.logicalId);
                break;
            }
            binding.lastCommittedHash = foundResource.calculateHash();
            state.setBinding(binding);
        }


        return {
            template: template,
            state
        }
    }

    private generateResource(lines: YamlLine[]) {
        lines.push(new Line('Resources', '', 0));
        lines.push(new EmptyLine());
        lines.push(new CommentedLine('IamBaseLine', '', 2));
        lines.push(new CommentedLine('Type', 'AWS::CloudFormation::Stack', 4));
        lines.push(new CommentedLine('OrganizationBindings', '', 4));
        lines.push(new CommentedLine('Regions', 'eu-central-1', 6));
        lines.push(new CommentedLine('Accounts', '*', 6));
        lines.push(new CommentedLine('IncludeMasterAccount', 'false', 6));
        lines.push(new CommentedLine('Properties', '', 4));
        lines.push(new CommentedLine('TemplateURL', './example.iam.baseline.yml', 6));
        lines.push(new CommentedLine('Parameters', '', 6));
        lines.push(new CommentedLine('UsersAccount', '!Ref UsersAccount', 8));
        lines.push(new EmptyLine());

    }

    private generateSCP(lines: YamlLine[], policy: AWSPolicy) {
        const logicalName = this.logicalNames.getName(policy);

        lines.push(new Line(logicalName, '', 2));
        lines.push(new Line('Type', ResourceTypes.ServiceControlPolicy, 4));
        lines.push(new Line('Properties', '', 4));
        lines.push(new Line('PolicyName', policy.Name, 6));
        lines.push(new Line('Description', policy.PolicySummary.Description, 6));
        lines.push(new ObjLine('PolicyDocument', JSON.parse(policy.Content), 6));
        lines.push(new EmptyLine());

        return {
            type: ResourceTypes.ServiceControlPolicy,
            logicalName: logicalName
        }
    }

    private generateAccount(lines: YamlLine[], account: AWSAccount) {
        const logicalName = this.logicalNames.getName(account);
        const policiesList = account.Policies.filter(x=>!x.PolicySummary.AwsManaged).map(x=> '!Ref ' + this.logicalNames.getName(x));

        lines.push(new Line(logicalName, '', 2));
        lines.push(new Line('Type', ResourceTypes.Account, 4));
        lines.push(new Line('Properties', '', 4));
        lines.push(new Line('AccountName', account.Name, 6));
        lines.push(new Line('AccountId', account.Id, 6));
        lines.push(new Line('Email', account.Email, 6));
        lines.push(new ListLine('ServiceControlPolicies', policiesList, 6));
        lines.push(new EmptyLine());

        return {
            type: ResourceTypes.Account,
            logicalName: logicalName
        }
    }

    private generateOrganizationalUnit(lines: YamlLine[], organizationalUnit: AWSOrganizationalUnit) {
        const logicalName = this.logicalNames.getName(organizationalUnit);
        const policiesList = organizationalUnit.Policies.filter(x=>!x.PolicySummary.AwsManaged).map(x=> '!Ref ' + this.logicalNames.getName(x));
        const accountList = organizationalUnit.Accounts.map(x=> '!Ref ' + this.logicalNames.getName(x));

        lines.push(new Line(logicalName, '', 2));
        lines.push(new Line('Type', ResourceTypes.OrganizationalUnit, 4));
        lines.push(new Line('Properties', '', 4));
        lines.push(new Line('OrganizationalUnitName', organizationalUnit.Name, 6));
        lines.push(new ListLine('ServiceControlPolicies', policiesList, 6));
        lines.push(new ListLine('Accounts', accountList, 6));
        lines.push(new EmptyLine());

        return {
            type: ResourceTypes.OrganizationalUnit,
            logicalName: logicalName
        }
    }

    private generateMasterAccount(lines: YamlLine[], masterAccount: AWSAccount) {
        const policiesList = masterAccount.Policies.map(x=> '!Ref ' + this.logicalNames.getName(x));

        lines.push(new Line('Organization', '', 0));
        lines.push(new Line('Root', '', 2));
        lines.push(new Line('Type',ResourceTypes.MasterAccount, 4));
        lines.push(new Line('Properties', '', 4));
        lines.push(new Line('AccountName', masterAccount.Name, 6));
        lines.push(new Line('AccountId', masterAccount.Id, 6));
        lines.push(new ListLine('ServiceControlPolicies', policiesList, 6));
        lines.push(new EmptyLine());

        return {
            type: ResourceTypes.MasterAccount,
            logicalName: 'Root'
        }
    }

    private generateTemplateHeader(lines: YamlLine[], organization: Organization) {
        lines.push(new Line('AWSTemplateFormatVersion','2010-09-09-OC', 0));
        lines.push(new Line('Description', `default template generated for organization with master account ${organization.MasterAccountId}`, 0));
        lines.push(new EmptyLine());
    }
}


export class DefaultTemplate {
    template: string;
    state: PersistedState;
}

class LogicalNames {
    names: Record<string, string> = {};
    takenNames: string[] = [];
    getName(element: AWSObject): string {
        const key = this.getKey(element);
        let name = this.names[key];
        if (!name) {
            this.names[key] = name = this.createName(element);
        }
        return name;
    }

    private createName(element: AWSObject): string {
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
        while (this.takenNames.includes(result))
        {
            result = name + i;
            i++;
        }
        return result;
    }

    private getPostFix(element: any): string {
        switch(element.Type) {
            case 'Account':
                return 'Account'

            case 'OrganizationalUnit':
                return 'OU';

            case 'Policy':
                return 'SCP'
        }
    }

    private getKey(element: any): string {
        return element.Type + element.Id;
    }
}

interface YamlLine {
    toString(): string;
}

class EmptyLine {
    toString() : string {
        return '\n';
    }
}

class ObjLine implements YamlLine {
    label: string;
    value: any;
    indentation: number;

    constructor(label: string, value: any, indentation: number) {
        this.label = label;
        this.value = value;
        this.indentation = indentation;
    }

    toString() : string {
        const indentation = ''.padStart(this.indentation, ' ');
        let line = `${indentation}${this.label}:\n`;
        const value = Yaml.stringify(this.value, 10, 2);
        const formatted = value.split('\n').map(part=> `${indentation}  ${part}`).join('\n');
        return line +formatted ;
    }
}
class Line implements YamlLine {
    label: string;
    value: string;
    indentation: number;

    constructor(label: string, value: string, indentation: number) {
        this.label = label;
        this.value = value;
        this.indentation = indentation;
    }

    toString() : string {
        let val = this.value;
        if (val == '*') {
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

    constructor(label: string, value: string, indentation: number) {
        super(label, value, indentation)
    }

    toString() : string {
        return '#' + super.toString();
    }
}

class ListLine implements YamlLine {
    label: string;
    values: string[];
    indentation: number;

    constructor(label: string, values: string[], indentation: number) {
        this.label = label;
        this.values = values;
        this.indentation = indentation;
    }

    toString() : string {
        if (this.values.length === 0) return '';
        if (this.values.length === 1) {
            return new Line(this.label, this.values[0], this.indentation).toString();
        }
        const indentation = ''.padStart(this.indentation, ' ');
        const line = `${indentation}${this.label}:\n`;
        const values = this.values.map(x=> `${indentation}  - ${x}`).join('\n');
        return line + values + '\n';
    }
}
