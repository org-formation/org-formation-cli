
import { expect } from 'chai';
import Sinon = require('sinon');
import { AwsUtil } from '../../src/aws-util';
import { ValidateTasksCommand } from '../../src/commands/validate-tasks';
import { ConsoleUtil } from '../../src/console-util';

describe('when validating examples', () => {

    const sandbox = Sinon.createSandbox();
    let logErrorStub: Sinon.SinonStub;
    let logWarnStub: Sinon.SinonStub;

    beforeEach(() => {
        logErrorStub = sandbox.stub(ConsoleUtil, 'LogError');
        logWarnStub = sandbox.stub(ConsoleUtil, 'LogWarning');
        sandbox.stub(ConsoleUtil, 'LogInfo');
        AwsUtil.ClearCache();
    });
    afterEach(() => {
        sandbox.restore();
    });

    it('will return no errors or warnings', async () => {
        const command = new ValidateTasksCommand();
        (command as any).command = {tasksFile: './examples/build-tasks.yml', stateBucketName: 'organization-formation-${AWS::AccountId}', stateObject: 'state.json', profile: 'org-formation'};
        await command.invoke();
        for (const call of logErrorStub.getCalls()) {
            console.log(call.args[0]);
        }
        for (const call of logWarnStub.getCalls()) {
            console.log(call.args[0]);
        }
        expect(logErrorStub.callCount).to.eq(0);
        expect(logWarnStub.callCount).to.eq(0);

    }).timeout(999999999);
});

describe('when validating work', () => {

    const sandbox = Sinon.createSandbox();
    let logErrorStub: Sinon.SinonStub;

    beforeEach(() => {
        logErrorStub = sandbox.stub(ConsoleUtil, 'LogError');
        sandbox.stub(ConsoleUtil, 'LogInfo');
        AwsUtil.ClearCache();
    });
    afterEach(() => {
        sandbox.restore();
    });

    it('will return no errors', async () => {
        const command = new ValidateTasksCommand();
        (command as any).command = {tasksFile: './work/orgformation-tasks.yml', stateBucketName: 'organization-formation-${AWS::AccountId}', stateObject: 'state.json', profile: 'work'};
        await command.invoke();
        for (const call of logErrorStub.getCalls()) {
            console.log(call.args[0]);
        }
        expect(logErrorStub.callCount).to.eq(0);

    }).timeout(999999999);
});

describe('when validating chainslayer', () => {

    const sandbox = Sinon.createSandbox();
    let logErrorStub: Sinon.SinonStub;

    beforeEach(() => {
        logErrorStub = sandbox.stub(ConsoleUtil, 'LogError');
        sandbox.stub(ConsoleUtil, 'LogInfo');
        AwsUtil.ClearCache();
    });
    afterEach(() => {
        sandbox.restore();
    });

    it('will return no errors', async () => {
        const command = new ValidateTasksCommand();
        (command as any).command = {tasksFile: './chainslayer/orgformation-tasks.yml', stateBucketName: 'organization-formation-${AWS::AccountId}', stateObject: 'state.json', profile: 'chainslayer'};
        await command.invoke();
        for (const call of logErrorStub.getCalls()) {
            console.log(call.args[0]);
        }
        expect(logErrorStub.callCount).to.eq(0);

    }).timeout(999999999);
});
