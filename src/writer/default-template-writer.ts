import { Organizations } from 'aws-sdk/clients/all';
import { Organization } from 'aws-sdk/clients/organizations';
import * as Yaml from 'yamljs';
import { pascalCase } from 'pascal-case';
import { OrgFormationError } from '../org-formation-error';
import { AwsOrganization } from '~aws-provider/aws-organization';
import { AWSAccount, AWSOrganizationalUnit, AwsOrganizationReader, AWSPolicy, AWSRoot, IAWSObject } from '~aws-provider/aws-organization-reader';
import { IAccountProperties, IOrganizationalUnitProperties, OrgResourceTypes, Resource } from '~parser/model';
import { TemplateRoot } from '~parser/parser';
import { IBinding, PersistedState } from '~state/persisted-state';
import { DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS } from '~util/aws-util';


export class DefaultTemplateWriter {
    public organizationModel: AwsOrganization;
    public logicalNames: LogicalNames;
    public DefaultBuildProcessAccessRoleName: string;

    constructor(organizationModel?: AwsOrganization) {
        if (organizationModel) {
            this.organizationModel = organizationModel;
        } else {
            const org = new Organizations({ region: 'us-east-1' });
            const reader = new AwsOrganizationReader(org);
            this.organizationModel = new AwsOrganization(reader);
        }
        this.logicalNames = new LogicalNames();
    }

    public async generateDefaultTemplate(templateGenerationSettings: ITemplateGenerationSettings = { predefinedAccounts: [], predefinedOUs: [] }): Promise<DefaultTemplate> {
        await this.organizationModel.initialize();
        const bindings: IBinding[] = [];
        const state = PersistedState.CreateEmpty(this.organizationModel.masterAccount.Id);
        const lines: YamlLine[] = [];
        this.generateTemplateHeader(lines, this.organizationModel.organization);

        const result = this.generateMasterAccount(lines, this.organizationModel.masterAccount);

        const masterAccountBinding: IBinding = {
            type: result.type,
            logicalId: result.logicalName,
            physicalId: this.organizationModel.masterAccount.Id,
            lastCommittedHash: '',
        };

        if (this.organizationModel.masterAccount.PartitionId) {
            masterAccountBinding.partitionId = this.organizationModel.masterAccount.PartitionId;
        }

        bindings.push(masterAccountBinding);

        for (const root of this.organizationModel.roots) {
            const rootResource = this.generateRoot(lines, root, this.organizationModel.masterAccount);

            if (!root.Id) {
                throw new OrgFormationError(`organizational root ${root.Name} has no Id`);
            }
            const partitionRoot: AWSRoot[] = this.organizationModel.partitionRoots;

            bindings.push({
                type: rootResource.type,
                logicalId: rootResource.logicalName,
                physicalId: root.Id,
                lastCommittedHash: '',
                partitionId: (partitionRoot) ? partitionRoot[0].Id : '',
            });
        }
        for (const predefinedOu of templateGenerationSettings.predefinedOUs) {
            const ou = this.organizationModel.organizationalUnits.find(x => x.Id === predefinedOu.id);
            const ouResource = this.generatePredefinedOU(lines, predefinedOu, templateGenerationSettings, ou);
            bindings.push({
                type: ouResource.type,
                logicalId: ouResource.logicalName,
                physicalId: predefinedOu.id,
                lastCommittedHash: '',
                partitionId: predefinedOu.id,
            });

        }
        for (const organizationalUnit of this.organizationModel.organizationalUnits) {
            const wasPredefined = templateGenerationSettings.predefinedOUs.some(x => x.id === organizationalUnit.Id);
            if (wasPredefined) { continue; }
            const organizationalUnitResource = this.generateOrganizationalUnit(lines, organizationalUnit);
            const partitionOu: AWSOrganizationalUnit = this.organizationModel.partitionOrganizationalUnits?.find(x => x.Name === organizationalUnit.Name);
            bindings.push({
                type: organizationalUnitResource.type,
                logicalId: organizationalUnitResource.logicalName,
                physicalId: organizationalUnit.Id,
                lastCommittedHash: '',
                partitionId: (partitionOu) ? partitionOu.Id : '',
            });
        }

        for (const predefinedAccount of templateGenerationSettings.predefinedAccounts) {
            const acct = this.organizationModel.accounts.find(x => x.Id === predefinedAccount.id);
            const accountResource = this.generatePredefinedAccount(lines, predefinedAccount, acct);
            bindings.push({
                type: accountResource.type,
                logicalId: accountResource.logicalName,
                physicalId: predefinedAccount.id,
                lastCommittedHash: '',
            });
        }

        for (const account of this.organizationModel.accounts) {
            const wasPredefined = templateGenerationSettings.predefinedAccounts.some(x => x.id === account.Id);
            if (wasPredefined) { continue; }

            const accountResource = this.generateAccount(lines, account);

            const accountBinding: IBinding = {
                type: accountResource.type,
                logicalId: accountResource.logicalName,
                physicalId: account.Id,
                lastCommittedHash: '',
            };

            if (account.PartitionId) {
                accountBinding.partitionId = account.PartitionId;
            }

            bindings.push(accountBinding);
        }
        for (const scp of this.organizationModel.policies) {
            if (scp.PolicySummary && scp.PolicySummary.AwsManaged) { continue; }
            const policyResource = this.generateSCP(lines, scp);
            const partitionPolicy: AWSPolicy = this.organizationModel.partitionPolicies?.find(x => x.Name === scp.Name);
            bindings.push({
                type: policyResource.type,
                logicalId: policyResource.logicalName,
                physicalId: scp.Id,
                lastCommittedHash: '',
                partitionId: (partitionPolicy) ? partitionPolicy.Id : '',
            });
        }

        this.generateResource(lines);

        const template = lines.map(x => x.toString()).join('');
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
                    foundResource = templateRoot.organizationSection.accounts.find(x => x.logicalId === binding.logicalId);
                    break;
                case OrgResourceTypes.OrganizationalUnit:
                    foundResource = templateRoot.organizationSection.organizationalUnits.find(x => x.logicalId === binding.logicalId);
                    break;
                case OrgResourceTypes.ServiceControlPolicy:
                    foundResource = templateRoot.organizationSection.serviceControlPolicies.find(x => x.logicalId === binding.logicalId);
                    break;
            }
            if (foundResource) {
                binding.lastCommittedHash = foundResource.calculateHash();
                state.setBinding(binding);
            }
        }

        return new DefaultTemplate(template, state);
    }

    private generateResource(lines: YamlLine[]): void {
        // lines.push(new Line('Resources', '', 0));
        // lines.push(new EmptyLine());
        // lines.push(new CommentedLine('IamBaseLine', '', 2));
        // lines.push(new CommentedLine('Type', 'AWS::CloudFormation::Stack', 4));
        // lines.push(new CommentedLine('OrganizationBinding', '', 4));
        // lines.push(new CommentedLine('Region', 'eu-central-1', 6));
        // lines.push(new CommentedLine('Accounts', '*', 6));
        // lines.push(new CommentedLine('IncludeMasterAccount', 'false', 6));
        // lines.push(new CommentedLine('Properties', '', 4));
        // lines.push(new CommentedLine('TemplateURL', './example.iam.baseline.yml', 6));
        // lines.push(new CommentedLine('Parameters', '', 6));
        // lines.push(new CommentedLine('UsersAccount', '!Ref UsersAccount', 8));
        lines.push(new EmptyLine());
    }

    private generateSCP(lines: YamlLine[], policy: AWSPolicy): WriterResource {
        const logicalName = this.logicalNames.getName(policy);

        lines.push(new Line(logicalName, '', 2));
        lines.push(new Line('Type', OrgResourceTypes.ServiceControlPolicy, 4));
        lines.push(new Line('Properties', '', 4));
        lines.push(new Line('PolicyName', policy.Name, 6));
        if (policy.PolicySummary && policy.PolicySummary.Description) {
            lines.push(new Line('Description', policy.PolicySummary.Description, 6));
        } else {
            lines.push(new Line('Description', '\'\'', 6));
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

    private generatePredefinedOU(lines: YamlLine[], predefined: IPredefinedOU, overrides: ITemplateGenerationSettings, preExistingOU?: AWSOrganizationalUnit): WriterResource {
        const logicalName = this.logicalNames.getForPredefined('OrganizationalUnit', predefined.id, predefined.logicalName);


        lines.push(new Line(logicalName, '', 2));
        lines.push(new Line('Type', OrgResourceTypes.OrganizationalUnit, 4));
        lines.push(new Line('Properties', '', 4));
        lines.push(new Line('OrganizationalUnitName', preExistingOU?.Name ?? predefined.properties.OrganizationalUnitName, 6));
        if (preExistingOU) {
            const policiesList = preExistingOU.Policies.filter(x => !x.PolicySummary!.AwsManaged!).map(x => '!Ref ' + this.logicalNames.getName(x));
            const accountList = preExistingOU.Accounts.map(x => '!Ref ' + this.logicalNames.getName(x));
            const childOUList = preExistingOU.OrganizationalUnits.map(x => '!Ref ' + this.logicalNames.getName(x));

            lines.push(new ListLine('ServiceControlPolicies', policiesList, 6));
            lines.push(new ListLine('OrganizationalUnits', childOUList, 6));
            lines.push(new ListLine('Accounts', accountList, 6));
        } else {
            lines.push(new ListLine('Accounts', predefined.properties.Accounts as string[], 6));
        }
        lines.push(new EmptyLine());

        return {
            type: OrgResourceTypes.OrganizationalUnit,
            logicalName,
        };

    }

    private generatePredefinedAccount(lines: YamlLine[], predefined: IPredefinedAccount, preExistingAccount?: AWSAccount): WriterResource {

        const logicalName = this.logicalNames.getForPredefined('Account', predefined.id, predefined.logicalName);

        lines.push(new Line(logicalName, '', 2));
        lines.push(new Line('Type', OrgResourceTypes.Account, 4));
        lines.push(new Line('Properties', '', 4));
        lines.push(new Line('AccountName', preExistingAccount ? preExistingAccount.Name : predefined.properties.AccountName, 6));
        lines.push(new Line('AccountId', predefined.id, 6));
        const rootEmail = preExistingAccount?.Email ?? predefined.properties.RootEmail;
        if (rootEmail) {
            lines.push(new Line('RootEmail', rootEmail, 6));
        }
        const alias = preExistingAccount?.Alias ?? predefined.properties.Alias;
        if (alias) {
            lines.push(new Line('Alias', alias, 6));
        }
        const combinedTags = { ...(predefined.properties.Tags ?? {}), ...(preExistingAccount?.Tags ?? {}) };
        if (combinedTags) {
            const tags = Object.entries(combinedTags);
            if (tags.length > 0) {
                lines.push(new Line('Tags', '', 6));
                for (const tag of tags) {
                    lines.push(new Line(tag[0], tag[1], 8));
                }
            }
        }
        lines.push(new EmptyLine());
        return {
            type: OrgResourceTypes.Account,
            logicalName,
        };
    }
    private generateAccount(lines: YamlLine[], account: AWSAccount): WriterResource {
        const logicalName = this.logicalNames.getName(account);
        const policiesList = account.Policies.filter(x => !x.PolicySummary!.AwsManaged).map(x => '!Ref ' + this.logicalNames.getName(x));

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
        if (account.PartitionAlias) {
            lines.push(new Line('PartitionAlias', account.PartitionAlias, 6));
        }

        if (account.PartitionId) {
            lines.push(new Line('PartitionId', account.PartitionId, 6));
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

    private generateRoot(lines: YamlLine[], root: AWSRoot, masterAccount: AWSAccount): WriterResource {
        const logicalName = 'OrganizationRoot';
        const policiesList = root.Policies.filter(x => !x.PolicySummary!.AwsManaged).map(x => '!Ref ' + this.logicalNames.getName(x));

        lines.push(new Line(logicalName, '', 2));
        lines.push(new Line('Type', OrgResourceTypes.OrganizationRoot, 4));
        lines.push(new Line('Properties', '', 4));
        lines.push(new Line('DefaultOrganizationAccessRoleName', DEFAULT_ROLE_FOR_CROSS_ACCOUNT_ACCESS.RoleName, 6));
        if (this.DefaultBuildProcessAccessRoleName !== undefined) {
            lines.push(new Line('DefaultBuildAccessRoleName', this.DefaultBuildProcessAccessRoleName, 6));
        }
        lines.push(new ListLine('ServiceControlPolicies', policiesList, 6));
        if (masterAccount.PartitionId) {
            lines.push(new Line('MirrorInPartition', 'true', 6));
        }
        lines.push(new EmptyLine());

        return {
            type: OrgResourceTypes.OrganizationRoot,
            logicalName,
        };
    }

    private generateOrganizationalUnit(lines: YamlLine[], organizationalUnit: AWSOrganizationalUnit): WriterResource {
        const logicalName = this.logicalNames.getName(organizationalUnit);
        const policiesList = organizationalUnit.Policies.filter(x => !x.PolicySummary!.AwsManaged!).map(x => '!Ref ' + this.logicalNames.getName(x));
        const accountList = organizationalUnit.Accounts.map(x => '!Ref ' + this.logicalNames.getName(x));
        const childOUList = organizationalUnit.OrganizationalUnits.map(x => '!Ref ' + this.logicalNames.getName(x));

        lines.push(new Line(logicalName, '', 2));
        lines.push(new Line('Type', OrgResourceTypes.OrganizationalUnit, 4));
        lines.push(new Line('Properties', '', 4));
        lines.push(new Line('OrganizationalUnitName', organizationalUnit.Name, 6));
        lines.push(new ListLine('ServiceControlPolicies', policiesList, 6));
        lines.push(new ListLine('OrganizationalUnits', childOUList, 6));
        lines.push(new ListLine('Accounts', accountList, 6));
        lines.push(new EmptyLine());

        return {
            type: OrgResourceTypes.OrganizationalUnit,
            logicalName,
        };
    }

    private generateMasterAccount(lines: YamlLine[], masterAccount: AWSAccount): WriterResource {
        const policiesList = masterAccount.Policies.map(x => '!Ref ' + this.logicalNames.getName(x));
        const name = this.logicalNames.setName(masterAccount, 'ManagementAccount');
        lines.push(new Line('Organization', '', 0));
        lines.push(new Line(name, '', 2));
        lines.push(new Line('Type', OrgResourceTypes.MasterAccount, 4));
        lines.push(new Line('Properties', '', 4));
        lines.push(new Line('AccountName', masterAccount.Name, 6));
        lines.push(new Line('AccountId', masterAccount.Id, 6));
        if (masterAccount.Email) {
            lines.push(new Line('RootEmail', masterAccount.Email, 6));
        }
        if (masterAccount.Alias) {
            lines.push(new Line('Alias', masterAccount.Alias, 6));
        }
        if (masterAccount.PartitionId) {
            lines.push(new Line('PartitionId', masterAccount.PartitionId, 6));
        }
        if (masterAccount.Tags) {
            const tags = Object.entries(masterAccount.Tags);
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
            type: OrgResourceTypes.MasterAccount,
            logicalName: 'ManagementAccount',
        };
    }

    private generateTemplateHeader(lines: YamlLine[], organization: Organization): void {
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
    public setName(element: IAWSObject, name: string): string {
        const key = this.getKey(element);
        this.names[key] = name;
        return name;
    }

    public getName(element: IAWSObject): string {

        const key = this.getKey(element);
        let name = this.names[key];
        if (!name) {
            this.names[key] = name = this.createName(element);
        }
        return name;
    }
    public getForPredefined(type: string, id: string, logicalName: string): string {
        const key = this.getKey({ Type: type, Id: id });
        this.names[key] = logicalName;
        return logicalName;
    }
    private createName(element: IAWSObject): string {
        let name = element.Name;
        let postFix = this.getPostFix(element);

        name = pascalCase(name);
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

        this.takenNames.push(result);
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

        throw new OrgFormationError('not implemented');
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
        const formatted = value.split('\n').map(part => `${indentation}  ${part}`).join('\n');
        return line + formatted;
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
        if (typeof val === 'string') {
            if (val === '*') {
                val = '\'' + val + '\'';
            }
            if ('0987654321'.includes(val[0])) {
                val = '\'' + val + '\'';
            }
            if (typeof val.includes !== 'function') {
                console.log(typeof val);
            }
            if (val.includes(': ')) {
                val = '\'' + val + '\'';
            }
        }
        const indentation = ''.padStart(this.indentation, ' ');
        const line = `${indentation}${this.label}: ${val}`;
        return line.trimRight() + '\n';
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
        const values = this.values.map(x => `${indentation}  - ${x}`).join('\n');
        return line + values + '\n';
    }
}

interface WriterResource {
    type: string;
    logicalName: string;
}

export interface ITemplateGenerationSettings {
    predefinedAccounts: IPredefinedAccount[];
    predefinedOUs: IPredefinedOU[];
}

export interface IPredefinedAccount {
    logicalName: string;
    id: string;
    properties: IAccountProperties;
}
export interface IPredefinedOU {
    logicalName: string;
    id: string;
    properties: IOrganizationalUnitProperties;
}
