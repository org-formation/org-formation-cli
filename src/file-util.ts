import { writeFileSync } from 'fs';

export class FileUtil {
    public static writeFileSync(path: string, contents: string) {
        writeFileSync(path, contents);
    }
}
