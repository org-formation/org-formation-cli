import Sinon from 'sinon';
import { ConsoleUtil } from '~util/console-util';


describe('when logging to cli', () => {
    const sandbox = Sinon.createSandbox();
    let consoleLog: Sinon.SinonStub;
    let consoleDebug : Sinon.SinonStub;
    let consoleWarn: Sinon.SinonStub;
    let consoleError: Sinon.SinonStub;

    beforeEach(() => {
        consoleLog = sandbox.stub(console, 'log');
        consoleDebug = sandbox.stub(console, 'debug');
        consoleWarn = sandbox.stub(console, 'warn');
        consoleError = sandbox.stub(console, 'error');
    });

    afterEach(()=> {
        sandbox.restore();
        ConsoleUtil.verbose = false;
        ConsoleUtil.printStacktraces = false;
        ConsoleUtil.colorizeLogs = true;
    });

    test('console util error logs to console error', () => {
        ConsoleUtil.LogError('hello')
        expect(consoleError.callCount).toBe(1);
        expect(consoleError.getCall(0).args[0]).toContain('hello');
    });

    test('console util error logs prefixes with ERROR', () => {
        ConsoleUtil.LogError('hello')
        expect(consoleError.callCount).toBe(1);
        expect(consoleError.getCall(0).args[0]).toContain('ERROR: hello');
    });

    test('console util error logs in red', () => {
        ConsoleUtil.LogError('hello')
        expect(consoleError.callCount).toBe(1);
        expect(consoleError.getCall(0).args[0]).toContain('\x1b[31m');
    });

    test('console util warn logs to console warn', () => {
        ConsoleUtil.LogWarning('warn')
        expect(consoleWarn.callCount).toBe(1);
        expect(consoleWarn.getCall(0).args[0]).toContain('warn');
    });

    test('console util warn logs prefixes with WARN', () => {
        ConsoleUtil.LogWarning('warn')
        expect(consoleWarn.callCount).toBe(1);
        expect(consoleWarn.getCall(0).args[0]).toContain('WARN: warn');
    });
    test('console util warn logs in yellow', () => {
        ConsoleUtil.LogWarning('warn')
        expect(consoleWarn.callCount).toBe(1);
        expect(consoleWarn.getCall(0).args[0]).toContain('\x1b[33m');
    });

    test('console util info logs prefixes with INFO', () => {
        ConsoleUtil.LogInfo('hello')
        expect(consoleLog.callCount).toBe(1);
        expect(consoleLog.getCall(0).args[0]).toContain('INFO: hello');
    });

    test('console util debug doesnt log by default', () => {
        ConsoleUtil.LogDebug('hello')
        expect(consoleDebug.callCount).toBe(0);
    });

    test('console util debug does log when verbose', () => {
        ConsoleUtil.verbose = true;
        ConsoleUtil.LogDebug('hello')
        expect(consoleDebug.callCount).toBe(1);
        expect(consoleDebug.getCall(0).args[0]).toContain('DEBG: hello');
    });


    test('if coloring is disbled console util warn does not log in yellow', () => {
        ConsoleUtil.colorizeLogs = false;
        ConsoleUtil.LogWarning('warn');
        expect(consoleWarn.callCount).toBe(1);
        const message: string = consoleWarn.getCall(0).args[0];
        expect(message.indexOf('\x1b[33m')).toBe(-1);
    });


    test('if coloring is disbled console util error does not log in red', () => {
        ConsoleUtil.colorizeLogs = false;
        ConsoleUtil.LogError('error');
        expect(consoleError.callCount).toBe(1);
        const message: string = consoleError.getCall(0).args[0];
        expect(message.indexOf('\x1b[31m')).toBe(-1);
    });


});