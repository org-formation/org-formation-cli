import { CfnExpressionResolver } from "~core/cfn-expression-resolver";
import { CfnJsonString } from "~core/cfn-functions/cfn-json-string";

describe('when invoking cfn json string', () => {

    test('JSON string gets minimized', async () => {
        const element: any = {};
        const json = `{
            "key": "val"
        }`;
        CfnJsonString.resolve(null, {}, element, 'key', 'Fn::JsonString', json)

        expect(element.key).toBe('{"key":"val"}');
    });

    test('object gets converted to json', async () => {
        const element: any = {};
        const obj = {
            att: 'val',
            n: 1
        };
        CfnJsonString.resolve(null, {}, element, 'key', 'Fn::JsonString', obj)

        expect(element.key).toBe('{"att":"val","n":1}');
    });

    test('JSON string gets minimized passed as 1st arg of array', async () => {
        const element: any = {};
        const json = `{
            "key": "val"
        }`;
        CfnJsonString.resolve(null, {}, element, 'key', 'Fn::JsonString', [json])

        expect(element.key).toBe('{"key":"val"}');
    });

    test('object gets converted to json passed as 1st arg of array', async () => {
        const element: any = {};
        const obj = {
            att: 'val',
            n: 1
        };
        CfnJsonString.resolve(null, {}, element, 'key', 'Fn::JsonString', [obj])

        expect(element.key).toBe('{"att":"val","n":1}');
    });
    test('JSON string can be pretty printed', async () => {
        const element: any = {};
        const json = `{
            "key": "val"
        }`;
        CfnJsonString.resolve(null, {}, element, 'key', 'Fn::JsonString', [json, 'pretty-print']);

        expect(element.key).toBe('{\n  "key": "val"\n}');
    });

    test('object gets converted to json', async () => {
        const element: any = {};
        const obj = {
            att: 'val',
            n: 1
        };
        CfnJsonString.resolve(null, {}, element, 'key', 'Fn::JsonString', [obj, 'pretty-print']);

        expect(element.key).toBe('{\n  "att": "val",\n  "n": 1\n}');
    });
});