import { ValidateTasksCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll } from './base-integration-test';
import { DescribeStacksOutput } from 'aws-sdk/clients/cloudformation';

const basePathForScenario = './test/integration-tests/resources/scenario-organization-includes/';

describe('when including part of the organization.yml', () => {
  let context: IIntegrationTestContext;

  beforeAll(async () => {

    try {
      context = await baseBeforeAll();
      await context.prepareStateBucket(basePathForScenario + '../state.json');
      } catch (err) {
      expect(err.message ?? err).toBeUndefined();
    }
  });

  test('references across includes are valid', async () => {
    const command = context.command;

    await ValidateTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-deploy.yml' });
  });
});