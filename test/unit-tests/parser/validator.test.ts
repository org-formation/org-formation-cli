
import Sinon from 'sinon';
import { ConsoleUtil } from '~util/console-util';
import { Validator } from '~parser/validator';
import { IRCObject } from '~commands/base-command';
import { assert } from 'console';

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

describe('when validating runtime config', () => {
    let rc: IRCObject;


    beforeEach(() => {
        rc = {
            config: 'file.rc',
            configs: ['file1.rc', 'file.rc'],
        }
    });


    test('empty rc is valid', () => {
        Validator.validateRC(rc);
    });

    test('undefined rc is valid', () => {
        Validator.validateRC(undefined);
    });


    test('unknown attribute will raise exception', () => {
        (rc as any).unknownAttribute = 'val';
        expect(()=> Validator.validateRC(rc)).toThrowError(/unknownAttribute/);
    });

    test('exception contains list of config files', () => {
        (rc as any).unknownAttribute = 'val';
        expect(()=> Validator.validateRC(rc)).toThrowError(/file1.rc/);
        expect(()=> Validator.validateRC(rc)).toThrowError(/file.rc/);
    });

    test('exception contains list possible attributes', () => {
        (rc as any).unknownAttribute = 'val';
        expect(()=> Validator.validateRC(rc)).toThrowError(/organizationFile/);
        expect(()=> Validator.validateRC(rc)).toThrowError(/stateBucketName/);
    });

    test('exception does not contain config or configs', () => {
        (rc as any).unknownAttribute = 'val';
        try{
            Validator.validateRC(rc);
            throw new Error('expected exception to have been thrown');
        }catch(err) {
            const message: string = err.message;
            expect(message).toContain('unknownAttribute');
            expect(message.indexOf('configs,')).toBe(-1);
            expect(message.indexOf('config,')).toBe(-1);
        }
    });

})

describe('when validating positive number', () => {
    test('doesn\'t throw exception for valid number', () => {
        Validator.validatePositiveInteger(3, 'arg');
    });
    test('doesn\'t throw exception for numeric string', () => {
        Validator.validatePositiveInteger('3' as any, 'arg');
    });
    test('throws exception for negative number', () => {
        expect(()=> Validator.validatePositiveInteger(-3, 'arg')).toThrowError(/arg/);
        expect(()=> Validator.validatePositiveInteger(-3, 'arg')).toThrowError(/-3/);
    });
    test('throws exception non-number string', () => {
        expect(()=> Validator.validatePositiveInteger('asd' as any, 'arg')).toThrowError(/asd/);
        expect(()=> Validator.validatePositiveInteger('asd' as any, 'arg')).toThrowError(/arg/);
    });
});