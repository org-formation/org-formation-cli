import { CloudFormation } from 'aws-sdk';
import { ValidateTemplateInput } from 'aws-sdk/clients/cloudformation';
import uuid = require('uuid');
import { OrgFormationError } from '../org-formation-error';
import { ICfnBinding } from './cfn-binder';
import { ICfnTask } from './cfn-task-provider';

export class CfnValidateTaskProvider {

    public enumTasks(bindings: ICfnBinding[]): ICfnTask[] {
        const result: ICfnTask[] = [];
        for (const binding of bindings) {
            if (binding.action !== 'Delete') {
                const validationTask = this.createValidationTask(binding);
                result.push(validationTask);
            }
        }
        return result;
    }

    private createValidationTask(binding: ICfnBinding): ICfnTask {
        const descriptionsOfBoundParameters: string[] = [];
        const boundParameters = binding.template.enumBoundParameters();
        for (const paramName in boundParameters) {
            const param = boundParameters[paramName];
            delete param.ExportAccountId;
            delete param.ExportRegion;
            delete param.ExportName;
            param.Description = uuid();
            descriptionsOfBoundParameters.push(param.Description);
        }

        return {
            accountId: binding.accountId,
            region: binding.region,
            stackName: binding.stackName,
            isDependency: (): boolean => false,
            action: 'Validate',
            perform: async (): Promise<void> => {
                const templateBody = binding.template.createTemplateBody();
                const validateInput: ValidateTemplateInput =  {
                    TemplateBody: templateBody,
                };

                const cfn = new CloudFormation({region: binding.region});
                const result = await cfn.validateTemplate(validateInput).promise();
                const missingParameters: string[] = [];
                for (const param of result.Parameters) {

                    if (param.DefaultValue !== undefined) {
                        continue;
                    }
                    if (binding.parameters && (binding.parameters[param.ParameterKey] !== undefined)) {
                        continue;
                    }
                    if (descriptionsOfBoundParameters.includes(param.Description)) {
                        continue;
                    }
                    missingParameters.push(param.ParameterKey);
                }
                if (missingParameters.length > 0)  {
                    throw new OrgFormationError(`template expects parameter(s) ${missingParameters.join(', ')} which have not been provided`);
                }
            },
        };
    }
}
