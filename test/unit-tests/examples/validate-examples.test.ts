
import { expect } from 'chai';
import Sinon = require('sinon');
import { ValidateTasksCommand } from '../../../src/commands/validate-tasks';
import { ConsoleUtil } from '../../../src/console-util';

describe('when validating examples', () => {

    const sandbox = Sinon.createSandbox();
    let logErrorStub: Sinon.SinonStub;

    beforeEach(() => {
        logErrorStub = sandbox.stub(ConsoleUtil, 'LogError');
        sandbox.stub(ConsoleUtil, 'LogInfo');
    });
    afterEach(() => {
        sandbox.reset();
    });

    it('will return no errors', async () => {
        const command = new ValidateTasksCommand();
        (command as any).command = {tasksFile: './examples/build-tasks.yml', stateBucketName: 'organization-formation-${AWS::AccountId}', stateObject: 'state.json', profile: 'org-formation'};
        await command.invoke();
        for (const call of logErrorStub.getCalls()) {
            console.log(call.args[0]);
        }
        expect(logErrorStub.callCount).to.eq(0);

    }).timeout(10000);
});
