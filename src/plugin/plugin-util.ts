import { existsSync } from 'fs';
import path from 'path';
import { IPluginTask } from './plugin-binder';
import { IGenericTarget, PersistedState } from '~state/persisted-state';
import { TemplateRoot } from '~parser/parser';
import { CfnExpressionResolver } from '~core/cfn-expression-resolver';

export class PluginUtil {
    static PrependNpmInstall(workloadPath: string, command: string): string {
        const hasPackageLock = existsSync(path.resolve(workloadPath, 'package-lock.json'));
        if (hasPackageLock) {
            return 'npm ci && ' + command;
        } else {
            return 'npm i && ' + command;
        }
    }

    static CreateExpressionResolver(task: IPluginTask,target: IGenericTarget<any>, template: TemplateRoot, state: PersistedState, parametersFn: (parameters: Record<string, any>) => string): CfnExpressionResolver {
        const resolver = new CfnExpressionResolver();
        resolver.addParameter('AWS::AccountId', target.accountId);
        resolver.addParameter('AWS::Region', target.region);
        resolver.addResourceWithResolverFn('CurrentAccount', (resource: string, resourcePath: string | undefined) => CfnExpressionResolver.ResolveAccountExpressionByLogicalName(target.logicalAccountId, resourcePath, template, state));
        resolver.addResolver((resource: string, resourcePath: string | undefined) => CfnExpressionResolver.ResolveAccountExpressionByLogicalName(resource, resourcePath, template, state));

        task.parameters = resolver.resolve(task.parameters);
        const parametersAsString = parametersFn(task.parameters);
        resolver.addResourceWithAttributes('CurrentTask',  { Parameters : parametersAsString });

        return resolver;
    }
}
