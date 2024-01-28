import { PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll } from './base-integration-test';
import { PrintTasksCommand } from '~commands/print-tasks';
import { DescribeStacksCommand, DescribeStacksCommandOutput } from '@aws-sdk/client-cloudformation';

const basePathForScenario = './test/integration-tests/resources/scenario-anchors-aliases/';

describe('when calling org-formation perform tasks', () => {
  let context: IIntegrationTestContext;
  let anchorsAndAliases: DescribeStacksCommandOutput;

  beforeAll(async () => {

    try {
      context = await baseBeforeAll();
      await context.prepareStateBucket(basePathForScenario + '../state.json');
      const command = context.command;
      const { cfnClient } = context;

      await ValidateTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-deploy.yml' });
      await PrintTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-deploy.yml' })
      await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-deploy.yml' });

      anchorsAndAliases = await cfnClient.send(new DescribeStacksCommand({ StackName: 'anchors-and-aliases' }));


      await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '9-cleanup.yml', performCleanup: true });
    } catch (err) {
      expect(err.message ?? err).toBeUndefined();
    }
  });

  test('stack was deployed successfully', () => {
    expect(anchorsAndAliases).toBeDefined();
    expect(anchorsAndAliases.Stacks.length).toBe(1);
    expect(anchorsAndAliases.Stacks[0]).toBeDefined();
    expect(anchorsAndAliases.Stacks[0].StackStatus).toBe('CREATE_COMPLETE');
  });
});