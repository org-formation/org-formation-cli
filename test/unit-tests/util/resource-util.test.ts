import { ResourceUtil } from "~util/resource-util";

describe('when fixing versions', () => {
    test('dates are converted to string using UTC', ()=> {
        const obj = { Version : new Date('2020-09-09T00:00:00.000Z') };
        ResourceUtil.FixVersions(obj)
        expect(obj.Version).toBe('2020-09-09');
    });
});
