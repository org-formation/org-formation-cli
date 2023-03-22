import { readdirSync, statSync } from 'fs';
const crypto = require('crypto');
const path = require('path');
const md5File = require('md5-file');

export class Md5Util {
    public static Md5OfPath(fileOrDir: string, filesToIgnore: string[] = []): string {

        const outerStat = statSync(fileOrDir);
        if (outerStat.isFile()) {
            return md5File.sync(fileOrDir);
        }

        const files = readdirSync(fileOrDir);
        const hashes: string[] = [];
        const hashForDir = crypto.createHash('md5');

        files.forEach(file => {
            try {

                const shouldExplicitelyIgnore = filesToIgnore.some(pattern => {
                    const regex = new RegExp(pattern);
                    return regex.test(file);
                });

                if (file === '.serverless' || file === 'node_modules' || file === '.terraform' || file === 'terraform.tfstate' || file === 'terraform.tfstate.backup' || file === '.terraform.lock.hcl' || shouldExplicitelyIgnore) {
                    return;
                }

                const filepath = path.join(fileOrDir, file);
                const stat = statSync(filepath);

                let hashForFile;

                if (stat.isFile()) {
                    hashForFile = md5File.sync(filepath);
                } else if (stat.isDirectory()) {
                    hashForFile = Md5Util.Md5OfPath(filepath, filesToIgnore);
                } else {
                    hashForFile = null;
                }
                hashes.push(hashForFile);
            } catch {
                // ignore
            }
        });

        hashes.forEach(h => {
            if (h !== null) { hashForDir.update(h); }
        });

        return hashForDir.digest('hex');
    }
}
