import { Organizations } from 'aws-sdk/clients/all';
import { Organization } from 'aws-sdk/clients/organizations';
import * as Yaml from 'yamljs';
import { AwsOrganization } from '../aws-provider/aws-organization';
import { AWSAccount, AWSOrganizationalUnit, AwsOrganizationReader, AWSPolicy, AWSRoot, IAWSObject } from '../aws-provider/aws-organization-reader';
import { OrgFormationError } from '../org-formation-error';
import { Resource } from '../parser/model/resource';
import { OrgResourceTypes } from '../parser/model/resource-types';
import { TemplateRoot } from '../parser/parser';
import { IBinding, PersistedState } from '../state/persisted-state';

export class DefaultTemplateWriter {
    public organizationModel: AwsOrganization;
    public logicalNames: LogicalNames;

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

    public async generateDefaultTemplate(): Promise<DefaultTemplate> {
        await this.organizationModel.initialize();
        const bindings: IBinding[] = [];
        const state = PersistedState.CreateEmpty(this.organizationModel.masterAccount.Id);
        const lines: YamlLine[] = [];
        this.generateTemplateHeader(lines, this.organizationModel.organization);

        const result = this.generateMasterAccount(lines, this.organizationModel.masterAccount);

        bindings.push({
            type: result.type,
            logicalId: result.logicalName,
            physicalId: this.organizationModel.masterAccount.Id,
            lastCommittedHash: '',
        });

        for (const root of this.organizationModel.roots) {
            const result = this.generateRoot(lines, root);

            if (!root.Id) {
                throw new OrgFormationError(`organizational root ${root.Name} has no Id`);
            }
            bindings.push({
                type: result.type,
                logicalId: result.logicalName,
                physicalId: root.Id,
                lastCommittedHash: '',
            });
        }
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
            if (scp.PolicySummary && scp.PolicySummary.AwsManaged) { continue; }
            const result = this.generateSCP(lines, scp );

            bindings.push({
                type: result.type,
                logicalId: result.logicalName,
                physicalId: scp.Id,
                lastCommittedHash: '',
            });
        }

        this.generateResource(lines);

        const template = lines.map((x) => x.toString()).join('');
        const templateRoot = TemplateRoot.createFromContents(template);

        for (const binding of bindings) {
            let foundResource: Resource | undefined;
            switch (binding.type) {
                case OrgResourceTypes.MasterAccount:
                    foundResource = templateRoot.organizationSection.masterAccount;
                    break;
                case OrgResourceTypes.OrganizationRoot:
                    foundResource = templateRoot.organizationSection.organizationRoot;
                    break;
                case OrgResourceTypes.Account:
                    foundResource = templateRoot.organizationSection.accounts.find((x) => x.logicalId === binding.logicalId);
                    break;
                case OrgResourceTypes.OrganizationalUnit:
                    foundResource = templateRoot.organizationSection.organizationalUnits.find((x) => x.logicalId === binding.logicalId);
                    break;
                case OrgResourceTypes.ServiceControlPolicy:
                    foundResource = templateRoot.organizationSection.serviceControlPolicies.find((x) => x.logicalId === binding.logicalId);
                    break;
            }
            if (foundResource) {
                binding.lastCommittedHash = foundResource.calculateHash();
                state.setBinding(binding);
            }
        }

        return new DefaultTemplate(template, state);
    }

    private generateResource(lines: YamlLine[]) {
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

    private generateSCP(lines: YamlLine[], policy: AWSPolicy) {
        const logicalName = this.logicalNames.getName(policy);

        lines.push(new Line(logicalName, '', 2));
        lines.push(new Line('Type', OrgResourceTypes.ServiceControlPolicy, 4));
        lines.push(new Line('Properties', '', 4));
        lines.push(new Line('PolicyName', policy.Name, 6));
        if (policy.PolicySummary && policy.PolicySummary.Description) {
            lines.push(new Line('Description', policy.PolicySummary.Description, 6));
        }
        if (policy.Content) {
            lines.push(new ObjLine('PolicyDocument', JSON.parse(policy.Content), 6));
        }
        lines.push(new EmptyLine());

        return {
            type: OrgResourceTypes.ServiceControlPolicy,
            logicalName,
        };
    }

    private generateAccount(lines: YamlLine[], account: AWSAccount) {
        const logicalName = this.logicalNames.getName(account);
        const policiesList = account.Policies.filter((x) => !x.PolicySummary!.AwsManaged).map((x) => '!Ref ' + this.logicalNames.getName(x));

        lines.push(new Line(logicalName, '', 2));
        lines.push(new Line('Type', OrgResourceTypes.Account, 4));
        lines.push(new Line('Properties', '', 4));
        lines.push(new Line('AccountName', account.Name, 6));
        lines.push(new Line('AccountId', account.Id, 6));
        if (account.Email) {
            lines.push(new Line('RootEmail', account.Email, 6));
        }
        if (account.Alias) {
            lines.push(new Line('Alias', account.Alias, 6));
        }
        if (account.Tags) {
            const tags = Object.entries(account.Tags);
            if (tags.length > 0) {
                lines.push(new Line('Tags', '', 6));
                for (const tag of tags) {
                    lines.push(new Line(tag[0], tag[1], 8));
                }
            }
        }

        lines.push(new ListLine('ServiceControlPolicies', policiesList, 6));

        lines.push(new EmptyLine());

        return {
            type: OrgResourceTypes.Account,
            logicalName,
        };
    }

    private generateRoot(lines: YamlLine[], root: AWSRoot) {
        const logicalName = 'OrganizationRoot';
        const policiesList = root.Policies.filter((x) => !x.PolicySummary!.AwsManaged).map((x) => '!Ref ' + this.logicalNames.getName(x));

        lines.push(new Line(logicalName, '', 2));
        lines.push(new Line('Type', OrgResourceTypes.OrganizationRoot, 4));
        lines.push(new Line('Properties', '', 4));
        lines.push(new ListLine('ServiceControlPolicies', policiesList, 6));
        lines.push(new EmptyLine());

        return {
            type: OrgResourceTypes.OrganizationRoot,
            logicalName,
        };
    }

    private generateOrganizationalUnit(lines: YamlLine[], organizationalUnit: AWSOrganizationalUnit) {
        const logicalName = this.logicalNames.getName(organizationalUnit);
        const policiesList = organizationalUnit.Policies.filter((x) => !x.PolicySummary!.AwsManaged!).map((x) => '!Ref ' + this.logicalNames.getName(x));
        const accountList = organizationalUnit.Accounts.map((x) => '!Ref ' + this.logicalNames.getName(x));

        lines.push(new Line(logicalName, '', 2));
        lines.push(new Line('Type', OrgResourceTypes.OrganizationalUnit, 4));
        lines.push(new Line('Properties', '', 4));
        lines.push(new Line('OrganizationalUnitName', organizationalUnit.Name, 6));
        lines.push(new ListLine('ServiceControlPolicies', policiesList, 6));
        lines.push(new ListLine('Accounts', accountList, 6));
        lines.push(new EmptyLine());

        return {
            type: OrgResourceTypes.OrganizationalUnit,
            logicalName,
        };
    }

    private generateMasterAccount(lines: YamlLine[], masterAccount: AWSAccount) {
        const policiesList = masterAccount.Policies.map((x) => '!Ref ' + this.logicalNames.getName(x));

        lines.push(new Line('Organization', '', 0));
        lines.push(new Line('MasterAccount', '', 2));
        lines.push(new Line('Type', OrgResourceTypes.MasterAccount, 4));
        lines.push(new Line('Properties', '', 4));
        lines.push(new Line('AccountName', masterAccount.Name, 6));
        lines.push(new Line('AccountId', masterAccount.Id, 6));
        if (masterAccount.Alias) {
            lines.push(new Line('Alias', masterAccount.Alias, 6));
        }
        lines.push(new ListLine('ServiceControlPolicies', policiesList, 6));
        lines.push(new EmptyLine());

        return {
            type: OrgResourceTypes.MasterAccount,
            logicalName: 'MasterAccount',
        };
    }

    private generateTemplateHeader(lines: YamlLine[], organization: Organization) {
        lines.push(new Line('AWSTemplateFormatVersion', '2010-09-09-OC', 0));
        lines.push(new Line('Description', `default template generated for organization with master account ${organization.MasterAccountId}`, 0));
        lines.push(new EmptyLine());
    }
}

export class DefaultTemplate {
    public template: string;
    public state: PersistedState;

    constructor(template: string, state: PersistedState) {
        this.template = template;
        this.state = state;
    }
}

class LogicalNames {
    public names: Record<string, string> = {};
    public takenNames: string[] = [];
    public getName(element: IAWSObject): string {
        const key = this.getKey(element);
        let name = this.names[key];
        if (!name) {
            this.names[key] = name = this.createName(element);
        }
        return name;
    }

    private createName(element: IAWSObject): string {
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

    private getPostFix(element: any): string {
        switch (element.Type) {
            case 'Account':
                return 'Account';

            case 'OrganizationalUnit':
                return 'OU';

            case 'Policy':
                return 'SCP';
        }

        throw new Error('not implemented');
    }

    private getKey(element: any): string {
        return element.Type + element.Id;
    }
}

interface YamlLine {
    toString(): string;
}

class EmptyLine {
    public toString(): string {
        return '\n';
    }
}

class ObjLine implements YamlLine {
    public label: string;
    public value: any;
    public indentation: number;

    constructor(label: string, value: any, indentation: number) {
        this.label = label;
        this.value = value;
        this.indentation = indentation;
    }

    public toString(): string {
        const indentation = ''.padStart(this.indentation, ' ');
        const line = `${indentation}${this.label}:\n`;
        const value = Yaml.stringify(this.value, 10, 2);
        const formatted = value.split('\n').map((part) => `${indentation}  ${part}`).join('\n');
        return line + formatted ;
    }
}
class Line implements YamlLine {
    public label: string;
    public value: string;
    public indentation: number;

    constructor(label: string, value: string, indentation: number) {
        this.label = label;
        this.value = value;
        this.indentation = indentation;
    }

    public toString(): string {
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

    constructor(label: string, value: string, indentation: number) {
        super(label, value, indentation);
    }

    public toString(): string {
        return '#' + super.toString();
    }
}

class ListLine implements YamlLine {
    public label: string;
    public values: string[];
    public indentation: number;

    constructor(label: string, values: string[], indentation: number) {
        this.label = label;
        this.values = values;
        this.indentation = indentation;
    }

    public toString(): string {
        if (this.values.length === 0) { return ''; }
        if (this.values.length === 1) {
            return new Line(this.label, this.values[0], this.indentation).toString();
        }
        const indentation = ''.padStart(this.indentation, ' ');
        const line = `${indentation}${this.label}:\n`;
        const values = this.values.map((x) => `${indentation}  - ${x}`).join('\n');
        return line + values + '\n';
    }
}
