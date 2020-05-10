import { existsSync } from 'fs';
import path from 'path';

export class PluginUtil {
    static PrependNpmInstall(workloadPath: string, command: string): string {
        const hasPackageLock = existsSync(path.resolve(workloadPath, 'package-lock.json'));
        if (hasPackageLock) {
            return 'npm ci && ' + command;
        } else {
            return 'npm i && ' + command;
        }
    }
}
