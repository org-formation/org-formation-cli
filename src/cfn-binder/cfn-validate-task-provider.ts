import { CloudFormation } from 'aws-sdk';
import { ValidateTemplateInput } from 'aws-sdk/clients/cloudformation';
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
        return {
            accountId: binding.accountId,
            region: binding.region,
            stackName: binding.stackName,
            isDependency: () => false,
            action: 'Validate',
            perform: async () => {
                const boundParameters = binding.template.enumBoundParameters();
                for (const param of boundParameters) {
                    delete param.ExportAccountId;
                    delete param.ExportRegion;
                    delete param.ExportName;
                }
                const templateBody = binding.template.createTemplateBody();
                const validateInput: ValidateTemplateInput =  {
                    TemplateBody: templateBody,
                };

                const cfn = new CloudFormation({region: binding.region});
                await cfn.validateTemplate(validateInput).promise();
            },
        };
    }
}
