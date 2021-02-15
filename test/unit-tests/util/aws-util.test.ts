import path from 'path';
import fs from 'fs';
import cp, { ChildProcess, ExecException } from 'child_process';
import * as AWSMock from 'aws-sdk-mock';
import { examples as stsExamples } from 'aws-sdk/apis/sts-2011-06-15.examples.json';
import { AwsUtil } from '~util/aws-util';
import { ConsoleUtil } from '~util/console-util';

jest.mock('child_process');

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
            accessKeyId: 'KEY',
            secretAccessKey: 'SECRET',
            sessionToken: undefined
        });
    });

    test('initialize with profile containing mfa', async () => {
        const readLineSpy = jest.spyOn(ConsoleUtil, 'Readline').mockResolvedValueOnce(Promise.resolve('123456'));
        try {
            const credentials = await AwsUtil.InitializeWithProfile('mfa');
            // TODO: To mock this properly, we would need to setup a network interceptor
            expect(credentials).toMatchObject({
                profile: 'mfa',
                accessKeyId: expect.any(String),
                secretAccessKey: expect.any(String),
                sessionToken: expect.any(String)
            });
        } catch (err) {
            expect(err.message).toBe('Profile mfa did not include credential process');
        }
        expect(readLineSpy).toBeCalledTimes(1);
    });

    test('initialize with profile containing credential process', async () => {
        const mockProcess = JSON.stringify({
            Version: 1,
            Profile: 'credential-process',
            AccessKeyId: 'KEY',
            SecretAccessKey: 'SECRET',
            SessionToken: 'TOKEN',
            Expiration: ''
        });
        execSpy.mockImplementationOnce(function(
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
            accessKeyId: 'KEY',
            secretAccessKey: 'SECRET',
            sessionToken: 'TOKEN'
        });
    });

    test('initialize with profile containing aws sso config', async () => {
        const originalExistsSync = fs.existsSync;
        const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation(function(path: string): boolean {
            if (path.match(/[\/\\].aws[\/\\]sso[\/\\]cache/)) {
                return true;
            }
            return originalExistsSync(path);
        });
        const originalReadFileSync = fs.readFileSync;
        const readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockImplementation(function(path: string, options: any): any {
            if (path.match(/[\/\\].aws[\/\\]sso[\/\\]cache/)) {
                return JSON.stringify({
                    startUrl: 'https://11111111.awsapps.com/start',
                    region: 'us-east-1',
                    accessToken: 'eyAAAAA',
                    expiresAt: '2021-02-11T06:04:07UTC'
                });
            }
            return originalReadFileSync(path, options);
        });
        const roleCredentials = {
            accessKeyId: 'KEY',
            secretAccessKey: 'SECRET',
            sessionToken: 'TOKEN',
            expiration: 2000000000
        };
        const getRoleCredentialsMock = (_: any, callback: any): any => {
            callback(null, { roleCredentials });
        };
        AWSMock.mock('SSO', 'getRoleCredentials', getRoleCredentialsMock);
        const credentials = await AwsUtil.InitializeWithProfile('aws-sso');
        expect(credentials).toMatchObject({
            profile: 'aws-sso',
            accessKeyId: roleCredentials.accessKeyId,
            secretAccessKey: roleCredentials.secretAccessKey,
            sessionToken: roleCredentials.sessionToken
        });
        expect(existsSyncSpy).toBeCalled();
        expect(readFileSyncSpy).toBeCalled();
    });
});
