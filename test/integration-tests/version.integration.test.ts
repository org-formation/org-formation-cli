import { expect } from 'chai';
import { spawnSync } from 'child_process';
describe('when calling org-formation --version', () => {

    let stdout: string;

    beforeEach(() => {
        const response = spawnSync('ts-node', ['cli.ts', '--version']);
        stdout = response.stdout.toString();
    });

    it('returns version to stdout', () => {
        expect(stdout).to.not.be.undefined;

        const pjson = require('../../package.json');
        expect(stdout).to.eq(pjson.version + '\n');
    });
});
