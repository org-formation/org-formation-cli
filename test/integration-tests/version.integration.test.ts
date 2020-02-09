import { spawnSync } from 'child_process';
describe('when calling org-formation --version', () => {

    let stdout: string;

    beforeEach(() => {
        const response = spawnSync('ts-node', ['cli.ts', '--version']);
        stdout = response.stdout.toString();
    });

    test('returns version to stdout', () => {
        expect(stdout).toBeDefined();

        const pjson = require('../../package.json');
        expect(stdout).toBe(pjson.version + '\n');
    });
});
