import { UpdateStacksCommand, DescribeStacksCommand, DeleteStacksCommand } from "~commands/index";
import { readFileSync } from "fs";
import { IIntegrationTestContext, baseAfterAll, baseBeforeAll, profileForIntegrationTests } from "./base-integration-test";
import { ConsoleUtil } from "../../src/console-util";

const basePathForScenario = './test/integration-tests/resources/scenario-create-buckets/';

describe('when creating an S3 bucket in all accounts', () => {
    let context: IIntegrationTestContext;
    let describeStacksAfterUpdate: string;
    let describeStacksAfterDelete: string;

    beforeAll(async () => {

        context = await baseBeforeAll();
        const command = {stateBucketName: context.stateBucketName, stateObject: 'state.json', stackName: context.stackName, profile: profileForIntegrationTests, verbose: true, maxConcurrentStacks: 10, failedStacksTolerance: 0 };

        const consoleOutMock = jest.spyOn(ConsoleUtil, 'Out').mockImplementation();

        await context.s3client.createBucket({ Bucket: context.stateBucketName }).promise();
        await context.s3client.upload({ Bucket: command.stateBucketName, Key: command.stateObject, Body: readFileSync(basePathForScenario + '0-state.json') }).promise();

        await UpdateStacksCommand.Perform({...command, templateFile: basePathForScenario + 'buckets.yml'});
        await DescribeStacksCommand.Perform(command);
        describeStacksAfterUpdate = consoleOutMock.mock.calls[0][0] as string;

        await DeleteStacksCommand.Perform(command);
        await DescribeStacksCommand.Perform(command);
        describeStacksAfterDelete = consoleOutMock.mock.calls[1][0] as string;
    })

    test('describe stacks outputs 1 stack after creating buckets', () => {
        const outputObject = JSON.parse(describeStacksAfterUpdate);
        expect(outputObject).toBeDefined();
        expect(outputObject[context.stackName]).toBeDefined();
        expect(Object.keys(outputObject).length).toBe(1)
    })

    test('describe stacks outputs 0 stacks after delete stacks', () => {
        const outputObject = JSON.parse(describeStacksAfterDelete);
        expect(outputObject).toBeDefined();
        expect(Object.keys(outputObject).length).toBe(0)
    })

    afterAll(async () => {
        await baseAfterAll(context);
    });
})