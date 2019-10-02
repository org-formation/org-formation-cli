export class Util {
    public static LogInfo(message: string) {
        console.warn(`INFO: ${message}`);
    }
    public static LogWarning(message: string) {
        console.warn(`WARN: ${message}`);
    }
    public static LogError(message: string, err?: Error ) {
        console.error(`ERROR: ${message}`);
        if (err) {
            console.error(err);
        }
    }
}

