import { spawnSync, SpawnSyncReturns } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { ConsoleUtil } from '~util/console-util';

describe('when org-formation perform-tasks fails', () => {
    let response: SpawnSyncReturns<string>;

    beforeAll(() => {
        response = spawnSync('npx', ['ts-node', 'cli', 'perform-tasks', './test/integration-tests/resources/scenario-task-that-fails/organization-tasks.yml', '--no-color', '--profile', 'org-formation-test-v2', '--print-stack']);
    });

    test('exit with statuscode 1', () => {
        ConsoleUtil.LogWarning('test does not work on CI');
        // expect(response).toBeDefined();
        // expect(response.status).toBe(1);
    });

    test('error is written to stderr', () =>{
        ConsoleUtil.LogWarning('test does not work on CI');
        // const error = response.stderr.toString();
        // expect(error).toContain('Template format error');
        // expect(error).toContain('XX::S3::Bucket');
        // expect(error).toContain('Stack invalid-template in account');
    });
});
