
import Sinon from 'sinon';
import { AwsUtil } from '../../src/aws-util';
import { ValidateTasksCommand } from '~commands/validate-tasks';
import { ConsoleUtil } from '../../src/console-util';

jest.setTimeout(99999999);

describe('when validating examples', () => {

    const sandbox = Sinon.createSandbox();
    let logErrorStub: Sinon.SinonSpy;
    let logWarnStub: Sinon.SinonSpy;

    beforeEach(() => {
        logErrorStub = sandbox.spy(ConsoleUtil, 'LogError');
        logWarnStub = sandbox.spy(ConsoleUtil, 'LogWarning');
        sandbox.stub(ConsoleUtil, 'LogInfo');
        AwsUtil.ClearCache();
    });
    afterEach(() => {
        sandbox.restore();
    });

    test('will return no errors or warnings', async () => {
        const command = new ValidateTasksCommand();
        (command as any).command = {tasksFile: './examples/organization-tasks.yml', stateBucketName: 'organization-formation-${AWS::AccountId}', stateObject: 'state.json', profile: 'org-formation'};
        await command.invoke();
        expect(logErrorStub.callCount).toBe(0);
        expect(logWarnStub.callCount).toBe(0);

    });
});

describe('when validating work', () => {

    const sandbox = Sinon.createSandbox();
    let logErrorStub: Sinon.SinonSpy;

    beforeEach(() => {
        logErrorStub = sandbox.spy(ConsoleUtil, 'LogError');
        sandbox.stub(ConsoleUtil, 'LogInfo');
        AwsUtil.ClearCache();
    });
    afterEach(() => {
        sandbox.restore();
    });

    test('will return no errors', async () => {
        const command = new ValidateTasksCommand();
        (command as any).command = {tasksFile: './work/orgformation-tasks.yml', stateBucketName: 'organization-formation-${AWS::AccountId}', stateObject: 'state.json', profile: 'work'};
        await command.invoke();
        expect(logErrorStub.callCount).toBe(0);

    });
});

// describe('when validating chainslayer', () => {

//     const sandbox = Sinon.createSandbox();
//     let logErrorStub: Sinon.SinonStub;

//     beforeEach(() => {
//         logErrorStub = sandbox.stub(ConsoleUtil, 'LogError');
//         sandbox.stub(ConsoleUtil, 'LogInfo');
//         AwsUtil.ClearCache();
//     });
//     afterEach(() => {
//         sandbox.restore();
//     });

//     test('will return no errors', async () => {
//         const command = new ValidateTasksCommand();
//         (command as any).command = {tasksFile: './chainslayer/orgformation-tasks.yml', stateBucketName: 'organization-formation-${AWS::AccountId}', stateObject: 'state.json', profile: 'chainslayer'};
//         await command.invoke();
//         for (const call of logErrorStub.getCalls()) {
//             console.log(call.args[0]);
//         }
//         expect(logErrorStub.callCount).toBe(0);

//     });
// });
