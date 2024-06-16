import { PerformTasksCommand, ValidateTasksCommand } from "~commands/index";
import { IIntegrationTestContext, baseBeforeAll, baseAfterAll } from "./base-integration-test";
import { PrintTasksCommand } from "~commands/print-tasks";
import { DescribeStacksCommand, DescribeStacksCommandOutput } from "@aws-sdk/client-cloudformation";

const basePathForScenario = './test/integration-tests/resources/scenario-include-various/';


describe('when cleaning up stacks', () => {
    let context: IIntegrationTestContext;
    let tetsIncludes: DescribeStacksCommandOutput;

    beforeAll(async () => {
        try {
            context = await baseBeforeAll();

            await context.prepareStateBucket(basePathForScenario + '../state.json');
            const { command, cfnClient } = context;
            await ValidateTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-deploy.yml' });
            await PrintTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-deploy.yml' })
            await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '1-deploy.yml' });

            tetsIncludes = await cfnClient.send(new DescribeStacksCommand({ StackName: 'test-includes' }));


            await PerformTasksCommand.Perform({ ...command, tasksFile: basePathForScenario + '9-cleanup.yml', performCleanup: true });
        }
        catch (err) {
            expect(err.message).toBe('');
        }
    });

    test('test exclude stack was deployed', () => {
        expect(tetsIncludes).toBeDefined();
        expect(tetsIncludes.Stacks.length).toBe(1);
        expect(tetsIncludes.Stacks[0]).toBeDefined();
        expect(tetsIncludes.Stacks[0].StackStatus).toBe('CREATE_COMPLETE');
    });

    test('test exclude stack was all right tag values in output', () => {
        expect(tetsIncludes).toBeDefined();
        const outputs = tetsIncludes.Stacks[0].Outputs;
        expect(outputs.find(x => x.OutputKey === "AccountATag1" && x.OutputValue === "overrwitten-from-within-include")).toBeDefined();
        expect(outputs.find(x => x.OutputKey === "MasterTag2" && x.OutputValue === "value")).toBeDefined();
        expect(outputs.find(x => x.OutputKey === "AccountATag2" && x.OutputValue === "value")).toBeDefined();
        expect(outputs.find(x => x.OutputKey === "MasterTag1" && x.OutputValue === "overwrittenValue")).toBeDefined();
    });


    afterAll(async () => {
        await baseAfterAll(context);
    })
});