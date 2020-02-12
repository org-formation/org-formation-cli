import { IBuildTaskConfiguration, IUpdateStackTaskConfiguration } from '../build-tasks/build-configuration';
import { ConsoleUtil } from '../console-util';
import { OrgFormationError } from '../org-formation-error';
import { IOrganizationBinding, IResourceRef, ITemplate } from './parser';

export class Validator {
    public static ValidateUpdateStacksTask(config: IUpdateStackTaskConfiguration, taskName: string) {
        if (config === undefined) { return; }

        if (config.Template === undefined) {
            throw new OrgFormationError(`Required atrribute Template missing for task ${taskName}`);
        }
        if (config.StackName === undefined) {
            throw new OrgFormationError(`Required atrribute StackName missing for task ${taskName}`);
        }
        if (config.OrganizationBinding !== undefined) {
            Validator.ValidateOrganizationBinding(config.OrganizationBinding, `task ${taskName}`);
        }
        if (config.DefaultOrganizationBinding !== undefined) {
            Validator.ValidateOrganizationBinding(config.DefaultOrganizationBinding, `task ${taskName}`);
        }
        for (const bindingName in config.OrganizationBindings) {
            const binding: IOrganizationBinding = config.OrganizationBindings[bindingName];
            Validator.ValidateOrganizationBinding(binding, `binding ${bindingName} of task ${taskName}`);
        }

        Validator.ThrowForUnknownAttribute(config, `task ${taskName}`,
            'Type', 'DependsOn', 'Template', 'StackName', 'StackDescription', 'Parameters',
            'DeletionProtection', 'OrganizationFile', 'OrganizationBinding', 'OrganizationBindingRegion', 'DefaultOrganizationBinding', 'DefaultOrganizationBindingRegion',
            'OrganizationBindings', 'TerminationProtection',
            'LogicalName', 'FilePath', 'MaxConcurrentStacks', 'FailedStackTolerance' );
    }

    public static ValidateTemplateRoot(root: ITemplate) {

        if (root.AWSTemplateFormatVersion === undefined) {
            throw new OrgFormationError('AWSTemplateFormatVersion is missing');
        }
        if (root.AWSTemplateFormatVersion !== '2010-09-09-OC' && root.AWSTemplateFormatVersion !== '2010-09-09') {
            throw new OrgFormationError(`Unexpected AWSTemplateFormatVersion version ${root.AWSTemplateFormatVersion}, expected '2010-09-09-OC or 2010-09-09'`);
        }
        if (!root.Organization) {
            throw new OrgFormationError('Top level Organization attribute is missing');
        }

        if (root.OrganizationBinding !== undefined) {
            Validator.ValidateOrganizationBinding(root.OrganizationBinding, 'top level OrganizationBinding');
        }

        if (root.DefaultOrganizationBinding !== undefined) {
            Validator.ValidateOrganizationBinding(root.DefaultOrganizationBinding, 'DefaultOrganizationBinding');
        }

        for (const bindingName in root.OrganizationBindings) {
            const binding: IOrganizationBinding = root.OrganizationBindings[bindingName];
            Validator.ValidateOrganizationBinding(binding, `binding ${bindingName}`);
        }

        Validator.ThrowForUnknownAttribute(root, 'template root',
            'AWSTemplateFormatVersion', 'Description', 'Organization', 'OrganizationBinding', 'DefaultOrganizationBinding', 'OrganizationBindings', 'DefaultOrganizationBindingRegion', 'OrganizationBindingRegion',
            'Metadata', 'Parameters', 'Mappings', 'Conditions', 'Resources', 'Outputs');

    }

    public static ValidateOrganizationBinding(binding: IOrganizationBinding, id: string) {
        if (binding === undefined || binding === null) {
            return;
        }
        if (binding.Account !== undefined) {
            Validator.validateReferenceToAccount(binding.Account, id);
        }
        if (binding.ExcludeAccount !== undefined) {
            Validator.validateReferenceToAccount(binding.ExcludeAccount, id);
        }
        if (binding.OrganizationalUnit !== undefined) {
            Validator.validateReferenceToOU(binding.OrganizationalUnit, id);
        }
        if (binding.IncludeMasterAccount !== undefined) {
            if (typeof binding.IncludeMasterAccount !== 'boolean') {
                throw new OrgFormationError(`expected value for IncludeMasterAccount on ${id} to be boolean (true | false)`);
            }
        }
        Validator.ThrowForUnknownAttribute(binding, id, 'OrganizationalUnit', 'Account', 'ExcludeAccount', 'Region', 'IncludeMasterAccount', 'AccountsWithTag');
    }

    public static ThrowForUnknownAttribute(obj: any, id: string, ...knownAttributes: string[]) {
        for (const att in obj) {
            if (knownAttributes.indexOf(att) < 0) {
                throw new OrgFormationError(`unexpected attribute ${att} found on ${id}`);
            }
        }
    }

    public static validateRegion(region: string) {
        if (typeof region === 'string') {
            if (!Validator.knownRegions.includes(region)) {
                ConsoleUtil.LogWarning(`region ${region} not recognized by tool, continuing anyway.`);
            }
        } else if (region) {
            throw new OrgFormationError(`region ${region} expected to be string, found ${typeof region}`);

        }
    }
    private static knownRegions = ['us-east-2', 'us-east-1', 'us-west-1', 'us-west-2', 'ap-east-1', 'ap-south-1', 'ap-northeast-3', 'ap-northeast-2', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ca-central-1', 'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-north-1', 'me-south-1', 'sa-east-1'];

    private static validateReferenceToAccount(resourceRefs: IResourceRef | IResourceRef[], id: string) {
        if (resourceRefs === undefined) { return; }

        const validateSingleReference = (elm: any) => {
            if (typeof elm === 'string') {
                if (elm.match(/\d{12}/)) {
                    throw new OrgFormationError(`Invalid account binding ${elm} on ${id}. Directly binding on accountId is not supported, use !Ref logicalId instead.`);
                } else if (elm !== '*') {
                    throw new OrgFormationError(`Invalid account binding ${elm} on ${id}. Expected literal '*' or !Ref logicalId.`);
                }
            } else if (typeof elm === 'object') {
                Validator.ThrowForUnknownAttribute(elm, `account binding ${id}`, 'Ref');
            } else {
                throw new OrgFormationError(`Unexpected type ${typeof elm} found on account binding ${id}. expected either string or object`);
            }
        };

        if (Array.isArray(resourceRefs)) {
            for (const elm of resourceRefs) {
                validateSingleReference(elm);
            }
        } else {
            validateSingleReference(resourceRefs);
        }
    }

    private static validateReferenceToOU(resourceRefs: IResourceRef | IResourceRef[], id: string) {
        const validateSingleReference = (elm: any) => {
            if (typeof elm === 'string') {
                if (elm.match(/\d{12}/)) {
                    throw new OrgFormationError(`Invalid organizational unit binding ${elm} on ${id}. Expected literal '*' or !Ref logicalId.`);
                }
            } else if (typeof elm === 'object')  {
                Validator.ThrowForUnknownAttribute(elm, `organizational unit binding ${id}`, 'Ref');
            } else {
                throw new OrgFormationError(`Unexpected type ${typeof elm} found on organizational unit binding ${id}. expected either string or object`);
            }
        };

        if (Array.isArray(resourceRefs)) {
            for (const elm of resourceRefs) {
                validateSingleReference(elm);
            }
        } else {
            validateSingleReference(resourceRefs);
        }
    }
}
