import { spawnSync, SpawnSyncReturns } from 'child_process';

describe('when org-formation perform-tasks fails', () => {
    let response: SpawnSyncReturns<string>;

    beforeAll(() => {
        response = spawnSync('npx', ['ts-node', 'cli', 'perform-tasks', './test/integration-tests/resources/scenario-task-that-fails/organization-tasks.yml', '--no-color', '--profile', 'org-formation-test-v2']);
    });

    test('exit with statuscode 1', () => {
        expect(response).toBeDefined();
        expect(response.status).toBe(1);
    });

    test('error is written to stderr', () =>{
        const error = response.stderr.toString();
        expect(error).toContain('Template format error');
        expect(error).toContain('XX::S3::Bucket');
        expect(error).toContain('failed executing stack invalid-template in account');
    });
});
