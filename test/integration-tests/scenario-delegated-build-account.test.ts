import { PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll } from './base-integration-test';
import { DescribeStacksOutput, GetStackPolicyOutput } from 'aws-sdk/clients/cloudformation';

const basePathForScenario = './test/integration-tests/resources/scenario-delegated-build-account/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;

    beforeAll(async () => {

        context = await baseBeforeAll('org-formation-test-delegated-build');
        await context.prepareStateBucket(basePathForScenario + '../state.json');
        const command = context.command;

        await ValidateTasksCommand.Perform({...command, tasksFile: basePathForScenario + '0-update-organization.yml', masterAccountId: '102625093955'});
        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + '0-update-organization.yml', masterAccountId: '102625093955'});

    });


    test('validation didnt throw', () => {

    })
});