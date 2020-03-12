import { PerformTasksCommand } from '~commands/index';
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll, profileForIntegrationTests } from './base-integration-test';
import { readFileSync } from 'fs';

const basePathForScenario = './test/integration-tests/resources/scenario-serverless-org-task/';

describe('when calling org-formation perform tasks', () => {
    let context: IIntegrationTestContext;

    beforeAll(async () => {
        context = await baseBeforeAll();
        const command = {stateBucketName: context.stateBucketName, stateObject: 'state.json', profile: profileForIntegrationTests, verbose: true, region: 'eu-west-1', performCleanup: true, maxConcurrentStacks: 10, failedStacksTolerance: 0, maxConcurrentTasks: 10, failedTasksTolerance: 0, logicalName: 'default' };

        await context.s3client.createBucket({ Bucket: context.stateBucketName }).promise();
        await context.s3client.upload({ Bucket: command.stateBucketName, Key: command.stateObject, Body: readFileSync(basePathForScenario + 'state.json') }).promise();

        await PerformTasksCommand.Perform({...command, tasksFile: basePathForScenario + 'organization-tasks.yml' })
    });

    test('', () => {

    })

    afterAll(async () => {
        await baseAfterAll(context);
    })

});