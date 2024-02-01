import { PerformTasksCommand, ValidateTasksCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll } from './base-integration-test';
import { NunjucksDebugSettings } from '~yaml-cfn/index';
import { PrintTasksCommand } from '~commands/print-tasks';
import { DescribeStacksCommand, DescribeStacksCommandOutput } from '@aws-sdk/client-cloudformation';

const basePathForScenario = './test/integration-tests/resources/scenario-text-template-all/';

describe('when calling org-formation perform tasks', () => {
  let context: IIntegrationTestContext;
  let stackA: DescribeStacksCommandOutput;
  let stackB: DescribeStacksCommandOutput;
  let stackC: DescribeStacksCommandOutput;

  beforeAll(async () => {
    try {
      NunjucksDebugSettings.debug = true;
      context = await baseBeforeAll();
      await context.prepareStateBucket(basePathForScenario + '../state.json');
      const command = context.command;
      const { cfnClient } = context;

      await ValidateTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-deploy-text-templated-things.yml' })
      await PrintTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-deploy-text-templated-things.yml' })
      await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-deploy-text-templated-things.yml' });

      stackA = await cfnClient.send(new DescribeStacksCommand({ StackName: 'buckets-a' }));
      stackB = await cfnClient.send(new DescribeStacksCommand({ StackName: 'buckets-b' }));
      stackC = await cfnClient.send(new DescribeStacksCommand({ StackName: 'buckets-c' }));

      await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '9-cleanup-text-templated-things.yml', performCleanup: true });
    } catch (err) {
      expect(err.message ?? err).toBeUndefined();
    }
  });

  test('stack was deployed three times', () => {
    for (const stack of [stackA, stackB, stackC]) {
      expect(stack).toBeDefined();
      expect(stack.Stacks.length).toBe(1);
      expect(stack.Stacks[0]).toBeDefined();
      expect(stack.Stacks[0].StackStatus).toBe('CREATE_COMPLETE');
    }
  });

});