
import { expect } from 'chai';
import Sinon = require('sinon');
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

    it('logs warning for unknown region', () => {
        Validator.validateRegion('eu-unknown-2');
        expect(logWarnStub.callCount).to.eq(1);
        expect(logWarnStub.getCall(0).args[0]).contains('eu-unknown-2');
    });

    it('doesn\'t throw an error for unknown region', () => {
        Validator.validateRegion('eu-unknown-2');
    });

    it('doesn\'t log warning for known region', () => {
        Validator.validateRegion('eu-central-1');
        expect(logWarnStub.callCount).to.eq(0);
    });

});
