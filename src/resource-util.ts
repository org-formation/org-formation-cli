export class ResourceUtil {
    public static FixVersions(obj: any) {
        if (obj !== null && typeof obj === 'object') {
            const entries = Object.entries(obj);
            for (const [key, val] of entries) {
                if (key === 'Version' && val instanceof Date) {
                    obj.Version = `${val.getFullYear()}-${val.getMonth()}-${val.getDate()}`;
                } else if (key === 'Version' && typeof val === 'string' && val.endsWith('T00:00:00.000Z')) {
                    obj.Version = val.substring(0, val.indexOf('T'));
                }
                if (val !== null && typeof val === 'object') {
                    this.FixVersions(val);
                }
            }
        }
    }
}
