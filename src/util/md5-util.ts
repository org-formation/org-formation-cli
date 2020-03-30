import { readdirSync, statSync } from 'fs';
const crypto = require('crypto');
const path = require('path');
const md5File = require('md5-file');

export class Md5Util {
    public static Md5OfPath(fileOrDir: string): string{

        const outerStat = statSync(fileOrDir);
        if (outerStat.isFile()) {
            return;
        }

        const files = readdirSync(fileOrDir);
        const hashes: string[] = [];
        const hashForDir = crypto.createHash('md5');

        files.forEach(file => {
            if( file === '.serverless') {
                return;
            }
            const filepath = path.join(fileOrDir, file);
            const stat = statSync(filepath);

            let hashForFile;

            if (stat.isFile()) {
                hashForFile = md5File.sync(filepath);
            } else if (stat.isDirectory()) {
                hashForFile = Md5Util.Md5OfPath(filepath);
            } else {
                hashForFile = null;
            }
            hashes.push(hashForFile);
        });

        hashes.forEach(h => {
            if (h !== null) { hashForDir.update(h); }
        });

        return hashForDir.digest('hex');
    }
}
