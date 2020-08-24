import { CfnExpressionResolver } from "~core/cfn-expression-resolver";
import { ICfnGetAttValue, ICfnRefValue } from "../cfn-types";
import { ICfnSubExpression } from "~core/cfn-expression";

describe('when having an expression resolver with parameter', () => {
    let resolver: CfnExpressionResolver;
    let target: any;

    beforeEach(() => {
        resolver = new CfnExpressionResolver();
        target = {
            obj: { att: 'val'},
            arr: ['val1', 'val2'],
            emptyArr: [],
            att: 'val',
        }
    });

    test('object without expressions will not be modified', async () => {
        const resolved = await resolver.resolve(target);
        expect(resolved.obj.att).toBe('val');
        expect(resolved.arr[0]).toBe('val1');
        expect(resolved.arr[1]).toBe('val2');
        expect(resolved.emptyArr.length).toBe(0);
        expect(resolved.att).toBe('val');
    });

    test('ref expression to parameter resolves to parameter value', async () => {
        resolver.addParameter('parameter', 'value');
        target.expr = { Ref: 'parameter' } as ICfnRefValue;
        const resolved = await resolver.resolve(target);
        expect(resolved.expr).toBe('value');
    });

    test('source does not change after resolving', async () => {
        resolver.addParameter('parameter', 'value');
        target.expr = { Ref: 'parameter' } as ICfnRefValue;
        const resolved = await resolver.resolve(target);
        expect(target.expr['Ref']).toBe('parameter');
    });

    test('ref expression to parameter in nested obj resolves to parameter value', async () => {
        resolver.addParameter('parameter', 'value');
        target.obj.expr = { Ref: 'parameter' } as ICfnRefValue;
        const resolved = await resolver.resolve(target);
        expect(resolved.obj.expr).toBe('value');
    });

    test('ref expression to parameter in arr obj resolves to parameter value', async () => {
        resolver.addParameter('parameter', 'value');
        target.arr[1] = { Ref: 'parameter' } as ICfnRefValue;
        const resolved = await resolver.resolve(target);
        expect(resolved.arr[1] ).toBe('value');
    });

    test('sub expression to parameter resolves to parameter value', async () => {
        resolver.addParameter('parameter', 'value');
        target.expr = { 'Fn::Sub' : '-${parameter}-'} as ICfnSubExpression;
        const resolved = await resolver.resolve(target);
        expect(resolved.expr).toBe('-value-');
    });

    test('sub expression to parameter in nested obj resolves to parameter value', async () => {
        resolver.addParameter('parameter', 'value');
        target.obj.expr = { 'Fn::Sub' : '-${parameter}-'} as ICfnSubExpression;
        const resolved = await resolver.resolve(target);
        expect(resolved.obj.expr).toBe('-value-');
    });

    test('sub expression to parameter in arr obj resolves to parameter value', async () => {
        resolver.addParameter('parameter', 'value');
        target.arr[1] = { 'Fn::Sub' : '-${parameter}-'} as ICfnSubExpression;
        const resolved = await resolver.resolve(target);
        expect(resolved.arr[1] ).toBe('-value-');
    });

});

describe('when having an expression resolver with object and attributes', () => {
    let resolver: CfnExpressionResolver;
    let target: any;

    beforeEach(() => {
        resolver = new CfnExpressionResolver();
        target = {
            obj: { att: 'val'},
            arr: ['val1', 'val2'],
            emptyArr: [],
            att: 'val',
        }
    });

    test('object without expressions will not be modified', async () => {
        const resolved = await resolver.resolve(target);
        expect(resolved.obj.att).toBe('val');
        expect(resolved.arr[0]).toBe('val1');
        expect(resolved.arr[1]).toBe('val2');
        expect(resolved.emptyArr.length).toBe(0);
        expect(resolved.att).toBe('val');
    });

    test('source does not change after resolving', async () => {
        resolver.addResourceWithAttributes('MySomething', { 'attrib' : 'attrib-value'});
        target.expr = { 'Fn::GetAtt': ['MySomething', 'attrib'] } as ICfnGetAttValue;
        const resolved = await resolver.resolve(target);
        expect(target.expr['Fn::GetAtt'][0]).toBe('MySomething');
        expect(target.expr['Fn::GetAtt'][1]).toBe('attrib');
    });

    test('get-att expression to attribute resolves to attribute value', async () => {
        resolver.addResourceWithAttributes('MySomething', { 'attrib' : 'attrib-value'});
        target.expr = { 'Fn::GetAtt': ['MySomething', 'attrib'] } as ICfnGetAttValue;
        const resolved = await resolver.resolve(target);
        expect(resolved.expr).toBe('attrib-value');
    });

    test('get-att expression to attribute in nested obj resolves to attribute value', async () => {
        resolver.addResourceWithAttributes('MySomething', { 'attrib' : 'attrib-value'});
        target.obj.expr = { 'Fn::GetAtt': ['MySomething', 'attrib'] } as ICfnGetAttValue;
        const resolved = await resolver.resolve(target);
        expect(resolved.obj.expr).toBe('attrib-value');
    });

    test('get-att expression to attribute in arr obj resolves to attribute value', async () => {
        resolver.addResourceWithAttributes('MySomething', { 'attrib' : 'attrib-value'});
        target.arr[1] = { 'Fn::GetAtt': ['MySomething', 'attrib'] } as ICfnGetAttValue;
        const resolved = await resolver.resolve(target);
        expect(resolved.arr[1] ).toBe('attrib-value');
    });

    test('sub expression to parameter resolves to parameter value', async () => {
        resolver.addResourceWithAttributes('MySomething', { 'attrib' : 'attrib-value'});
        target.expr = { 'Fn::Sub' : '-${MySomething.attrib}-'} as ICfnSubExpression;
        const resolved = await resolver.resolve(target);
        expect(resolved.expr).toBe('-attrib-value-');
    });

    test('sub expression to parameter in nested obj resolves to parameter value', async () => {
        resolver.addResourceWithAttributes('MySomething', { 'attrib' : 'attrib-value'});
        target.obj.expr = { 'Fn::Sub' : '-${MySomething.attrib}-'} as ICfnSubExpression;
        const resolved = await resolver.resolve(target);
        expect(resolved.obj.expr).toBe('-attrib-value-');
    });

    test('sub expression to parameter in arr obj resolves to parameter value', async () => {
        resolver.addResourceWithAttributes('MySomething', { 'attrib' : 'attrib-value'});
        target.arr[1] = { 'Fn::Sub' : '-${MySomething.attrib}-'} as ICfnSubExpression;
        const resolved = await resolver.resolve(target);
        expect(resolved.arr[1] ).toBe('-attrib-value-');
    });
});

describe('when collapsing expressions', () => {
    let resolver: CfnExpressionResolver;
    let target: any;

    beforeEach(() => {
        resolver = new CfnExpressionResolver();
        target = {
            complexSub:{
                'Fn::Sub': [
                    '${var1}, ${var2}',
                    { var1: 'val1', var2: 'val2'}]
                },
            nestedComplexSub:{
                'Fn::Sub': [
                    '${var1}, ${var2}',
                    { var1: 'val1', var2: {
                        'Fn::Sub': [
                            '${var1}, ${var2}',
                            { var1: 'val1', var2: 'val2'}]
                        }}]
                },
            join: {
                'Fn::Join': ['-', ['b', 'c']]
            },
            complexJoin: {
                'Fn::Join': ['|',
                    [
                        {   'Fn::Join': [
                                '-',
                                ['b', 'c']]},
                        {
                            'Fn::Sub': [
                                '${var1}, ${var2}',
                                { var1: 'val1', var2: 'val2'}]
                            }
                        ]
                    ]
            },

        }
    });

    test('Join collapses properly', async () => {
        const resolved = await resolver.collapse(target);
        expect(typeof resolved.join).toBe('string');
        expect(resolved.join).toBe('b-c');
    });

    test('complex join collapses properly', async () => {
        const resolved = await resolver.collapse(target);
        expect(typeof resolved.complexJoin).toBe('string');
        expect(resolved.complexJoin).toBe('b-c|val1, val2');
    });
    test('complex sub collapses properly', async () => {
        const resolved = await resolver.collapse(target);
        expect(typeof resolved.complexSub).toBe('string');
        expect(resolved.complexSub).toBe('val1, val2');
    });

    test('nested complex sub collapses properly', async () => {
        const resolved = await resolver.collapse(target);
        expect(typeof resolved.nestedComplexSub).toBe('string');
        expect(resolved.nestedComplexSub).toBe('val1, val1, val2');
    });

    test('source object is not modified', async () => {
        await resolver.collapse(target);
        expect(typeof target.complexSub).toBe('object');
    });
});