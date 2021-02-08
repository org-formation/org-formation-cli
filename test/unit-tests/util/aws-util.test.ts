import * as path from 'path';
import cp, { ChildProcess, ExecException } from 'child_process';
import * as AWSMock from 'aws-sdk-mock';
import { examples as stsExamples } from 'aws-sdk/apis/sts-2011-06-15.examples.json';
import { AwsUtil } from '~util/aws-util';

jest.mock('child_process');
jest.mock('../../../src/util/console-util', () => {
    return {
        ConsoleUtil: {
            Readline: async() => '123456'
        }
    };
});

const mockResult = (output: any): jest.Mock => {
    return jest.fn().mockResolvedValue(output);
};

AWSMock.setSDK(path.resolve('node_modules/aws-sdk'));

describe('when getting the master account id', () => {

    let masterAccountId: string;

    beforeAll(async () => {
        const callerIdentity = stsExamples.GetCallerIdentity[0].output;
        const getIdentity = mockResult(callerIdentity);
        AWSMock.mock('STS', 'getCallerIdentity', getIdentity);
        masterAccountId = await AwsUtil.GetMasterAccountId();
    });

    test('master account id is returned', () => {
        expect(masterAccountId).toBe('123456789012');
    });
});

describe('when initializing credentials', () => {

    let execSpy: jest.SpyInstance<cp.ChildProcess>;

    beforeAll(async () => {
        process.env.AWS_CONFIG_FILE = path.join(__dirname, 'aws-config-file');
        process.env.AWS_SHARED_CREDENTIALS_FILE = path.join(__dirname, 'aws-shared-credentials-file');
        execSpy = jest.spyOn(cp, 'exec');
    });

    afterEach(() => {
        jest.resetAllMocks();
        jest.restoreAllMocks();
    });

    test('initialize with default profile containing access key and secret', async () => {
        const credentials = await AwsUtil.InitializeWithProfile(null);
        expect(credentials).toMatchObject({
            profile: 'default',
            accessKeyId: 'ID',
            secretAccessKey: 'SECRET',
            sessionToken: undefined
        });
    });

    test('initialize with profile containing mfa', async () => {
        try {
            const credentials = await AwsUtil.InitializeWithProfile('mfa');
            // To mock this properly, we would need to setup a network interceptor
            expect(credentials).toMatchObject({
                profile: 'mfa',
                accessKeyId: expect.any(String),
                secretAccessKey: expect.any(String),
                sessionToken: expect.any(String)
            });
        } catch (err) {
            expect(err.message).toBe('Profile mfa did not include credential process');
        }
    });

    test('initialize with profile containing credential process', async () => {
        const mockProcess = '{"Version": 1,"Profile": "credential-process","AccessKeyId": "ID","SecretAccessKey": "SECRET","SessionToken": "SESSION","Expiration": ""}';
        execSpy.mockImplementation(function(
            this: ChildProcess,
            _command: string,
            _options: any,
            callback?: (error: ExecException | null, stdout: string, stderr: string) => void
        ): ChildProcess {
            if (!callback) {
                callback = _options;
            }
            callback(undefined, mockProcess, undefined);
            return this;
        });
        const credentials = await AwsUtil.InitializeWithProfile('credential-process');
        expect(execSpy).toBeCalledTimes(1);
        expect(credentials).toMatchObject({
            profile: 'credential-process',
            accessKeyId: 'ID',
            secretAccessKey: 'SECRET',
            sessionToken: 'SESSION'
        });
    });

    test('initialize with profile containing aws sso config', async () => {
        const mockProcess = '{"Version": 1,"Profile": "aws-sso","AccessKeyId": "ID","SecretAccessKey": "SECRET","SessionToken": "SESSION","Expiration": ""}';
        execSpy.mockImplementation(function(
            this: ChildProcess,
            _command: string,
            _options: any,
            callback?: (error: ExecException | null, stdout: string, stderr: string) => void
        ): ChildProcess {
            if (!callback) {
                callback = _options;
            }
            callback(undefined, mockProcess, undefined);
            return this;
        });
        const credentials = await AwsUtil.InitializeWithProfile('aws-sso');
        expect(execSpy).toBeCalledTimes(1);
        expect(credentials).toMatchObject({
            profile: 'aws-sso',
            accessKeyId: expect.any(String),
            secretAccessKey: expect.any(String),
            sessionToken: expect.any(String)
        });
    });
});