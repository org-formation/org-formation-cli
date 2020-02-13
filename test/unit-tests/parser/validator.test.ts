
import Sinon from 'sinon';
import { ConsoleUtil } from '../../../src/console-util';
import { Validator } from '../../../src/parser/validator';

describe('when validating region', () => {
    const sandbox = Sinon.createSandbox();
    let logWarnStub: Sinon.SinonStub;

    beforeEach(() => {
        logWarnStub = sandbox.stub(ConsoleUtil, 'LogWarning');
    });

    afterEach(() => {
        sandbox.restore();
    });

    test('logs warning for unknown region', () => {
        Validator.validateRegion('eu-unknown-2');
        expect(logWarnStub.callCount).toBe(1);
        expect(logWarnStub.getCall(0).args[0]).toContain('eu-unknown-2');
    });

    test('doesn\'t throw an error for unknown region', () => {
        Validator.validateRegion('eu-unknown-2');
    });

    test('doesn\'t log warning for known region', () => {
        Validator.validateRegion('eu-central-1');
        expect(logWarnStub.callCount).toBe(0);
    });

});
