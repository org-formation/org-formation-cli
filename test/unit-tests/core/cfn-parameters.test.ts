import { CfnParameters } from '~core/cfn-parameters';

describe('when processing stack parameters', () => {
  test('string parameters create an object', () => {
    const commandParameters = 'ParameterKey=foo,ParameterValue=bar ParameterKey=foo2,ParameterValue=bar2';
    const expected = { foo: 'bar', 'foo2': 'bar2' }
    const parsed = CfnParameters.ParseParameterValues(commandParameters)
    expect(parsed).toStrictEqual(expected)
  });

  test('string parameters create an object', () => {
    const commandParameters = 'ParameterKey=foo,ParameterValue=bar ParameterKey=foo2,ParameterValue=bar2';
    const expected = { foo: 'bar', 'foo2': 'bar2' }
    const parsed = CfnParameters.ParseParameterValues(commandParameters)
    expect(parsed).toStrictEqual(expected)
  });

  test('comma-delimited lists are parsed with comma escaping', () => {
    const commandParameters = 'ParameterKey=foo,ParameterValue=one\\,two ParameterKey=foo2,ParameterValue=bar2';
    const expected = { foo: 'one,two', 'foo2': 'bar2' }
    const parsed = CfnParameters.ParseParameterValues(commandParameters)
    expect(parsed).toStrictEqual(expected)
  });

  test('comma-delimited lists are parsed with quoting', () => {
    const commandParameters = 'ParameterKey=foo,ParameterValue="one,two" ParameterKey=foo2,ParameterValue="three,four"';
    const expected = { foo: 'one,two', 'foo2': 'three,four' }
    const parsed = CfnParameters.ParseParameterValues(commandParameters)
    expect(parsed).toStrictEqual(expected)
  });

  test('comma-delimited lists are parsed with mixed quoting and escaping', () => {
    const commandParameters = 'ParameterKey=a,ParameterValue="A1,A2" ParameterKey=b,ParameterValue=B1\,B2 ParameterKey=c,ParameterValue=C1\,C2';
    const expected = { a: 'A1,A2', b: 'B1,B2', c: 'C1,C2' }
    const parsed = CfnParameters.ParseParameterValues(commandParameters)
    expect(parsed).toStrictEqual(expected)
  });

  test('empty strings are handled', () => {
    const commandParameters = '';
    const expected = {}
    const parsed = CfnParameters.ParseParameterValues(commandParameters)
    expect(parsed).toStrictEqual(expected)
  });

  test('undefined parameters are handled', () => {
    const parsed = CfnParameters.ParseParameterValues(undefined)
    expect(parsed).toStrictEqual({})
  });

  test('key=value syntax is supported', () => {
    const commandParameters = 'foo=bar foo2=bar2';
    const expected = { foo: 'bar', foo2: 'bar2' };
    const parsed = CfnParameters.ParseParameterValues(commandParameters);
    expect(parsed).toStrictEqual(expected);
  })

  test('invalid syntax throws an error', () => {
    const commandParameters = 'foo-bar';
    expect(() => CfnParameters.ParseParameterValues(commandParameters)).toThrowError()
  })

  test('key=value syntax with multiple equals signs throws an error', () => {
    const commandParameters = 'foo=bar=bar2';
    expect(() => CfnParameters.ParseParameterValues(commandParameters)).toThrowError()
  })
});