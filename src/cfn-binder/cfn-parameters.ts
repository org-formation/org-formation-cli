import { ICfnExpression } from '~core/cfn-expression';
import { CfnExpressionResolver } from '~core/cfn-expression-resolver';

export class CfnParameters {

    static async resolveParameters(parameters: Record<string, ICfnExpression>, resolver: CfnExpressionResolver): Promise<Record<string, string>> {
        const result: Record<string, string> = {};
        for(const [name, expression] of Object.entries(parameters)) {
            const value = await resolver.resolveSingleExpression(expression, 'parameter ' + name);
            result[name] = value;
        }
        return result;
    }

}
