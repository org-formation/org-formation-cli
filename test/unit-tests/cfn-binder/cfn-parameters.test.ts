import { CfnParameters } from "~cfn-binder/cfn-parameters";
import { ICfnExpression } from "~core/cfn-expression";
import { CfnExpressionResolver } from "~core/cfn-expression-resolver";

describe('when resolving parameter expressions', () => {
    const resolver = new CfnExpressionResolver();

    test('arrays get collapsed to string', async () =>{
        const parameters = {'arr' : ['one', 'two'] } as any;
        const resolved = await CfnParameters.resolveParameters(parameters, resolver);
        expect(resolved.arr).toBe('one,two');
    });

    test('number becomes string', async () =>{
        const parameters = {'val' : 2 } as any;
        const resolved = await CfnParameters.resolveParameters(parameters, resolver);
        expect(resolved.val).toBe('2');
    });
    test('string stays string', async () =>{
        const parameters = {'val' : 'xxx' } as any;
        const resolved = await CfnParameters.resolveParameters(parameters, resolver);
        expect(resolved.val).toBe('xxx');
    });

    test('unresolvable object throws', async () =>{
        const parameters = {'val' : {Ref: 'somethingelse'} } as any;
       await expect( async () => await CfnParameters.resolveParameters(parameters, resolver)).rejects.toThrowError();

    });
});
