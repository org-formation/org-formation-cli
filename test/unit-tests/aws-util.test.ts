import * as path from 'path';
import * as AWSMock from 'aws-sdk-mock';
import { examples as stsExamples } from 'aws-sdk/apis/sts-2011-06-15.examples.json';
import { AwsUtil } from '../../src/aws-util';

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