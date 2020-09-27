import { CfnExpressionResolver } from "~core/cfn-expression-resolver";
import { ICfnGetAttValue, ICfnRefValue } from "../cfn-types";
import { ICfnSubExpression } from "~core/cfn-expression";

describe('when having an expression resolver with parameter', () => {
    let resolver: CfnExpressionResolver;
    let target: any;

    beforeEach(() => {
        const mappings: Record<string, Record<string, Record<string, string>>> = {
            'MyMap': {
                'MyGroup1': {
                        'MyKey' : 'MyVal1',
                        'MyKey2' : 'MyVal21',
                    },
                'MyGroup2': {
                        'MyKey' : 'MyVal2',
                        'MyKey2' : 'MyVal22',
                    },
            }
        }

        resolver = new CfnExpressionResolver();
        resolver.addMappings(mappings);
        resolver.addParameter('prmGroupName', 'MyGroup2');
        target = {
            fn: { 'Fn::FindInMap': ['MyMap', 'MyGroup1', 'MyKey2']},
            fn2: { 'Fn::FindInMap': ['MyMap', {'Ref': 'prmGroupName'}, 'MyKey2']},
            // arr: ['val1', 'val2'],
            // emptyArr: [],
            // att: 'val',
        }
    });

    test('FindInMap can be used to resolve value', async () => {
        const resolved = await resolver.resolve(target);
        const collapsed = await resolver.collapse(resolved);
        expect(collapsed.fn).toBe('MyVal21')
    });

    test('FindInMap can be used to resolve value using parameter as group name', async () => {
        const resolved1 = await resolver.resolveParameters(target);
        const resolved = await resolver.resolve(resolved1);
        const collapsed = await resolver.collapse(resolved);
        expect(collapsed.fn2).toBe('MyVal22')
    });
});