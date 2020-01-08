export class EnumTargets {

    private resolveEnumExpression(which: 'EnumTargetAccounts' | 'EnumTargetRegions', val: string, accountResource: AccountResource, replacementParameter: string) {
        const parts = val.split(' ');
        if (parts.length < 2 || parts.length > 3) {
            throw new OrgFormationError(`invalid ${parts[0]} expression ${parts.slice(1)}`);
        }
        const resourceId = parts[1];
        const cfnResource = this.templateRoot.resourcesSection.resources.find((x) => x.logicalId === resourceId);
        if (cfnResource === undefined) {
            throw new OrgFormationError(`unable to find resource ${resourceId} from  ${parts[0]} expression`);
        }
        const enumUnderlyingValues = [];
        if (which === 'EnumTargetAccounts') {
            const normalizedLogicalAccountIds = cfnResource.normalizedBoundAccounts;
            for (const logicalAccountId of normalizedLogicalAccountIds) {
                const otherAccount = this.templateRoot.organizationSection.findAccount((x) => x.logicalId === logicalAccountId);
                const physicalId = this.resolveAccountGetAtt(otherAccount, 'AccountId');
                enumUnderlyingValues.push(physicalId);
            }
        } else if (which === 'EnumTargetRegions') {
            enumUnderlyingValues.push(...cfnResource.regions);
        }

        let expression = '${' + replacementParameter + '}';
        if (parts.length === 3) {
            expression = parts[2];
        }
        const converted = this.convertExpression(enumUnderlyingValues, expression, replacementParameter);
        const result: any[] = [];
        for (const element of converted) {
            if (element.hasVariables()) {
                result.push({ 'Fn::Sub': element.getSubValue() });
            } else {
                result.push(element.getSubValue());
            }
        }
        if (result.length === 1) {
            return result[0];
        }
        return result;
    }

    private convertExpression(values: string[], expression: string, resourceId: string): SubExpression[] {
        const result: SubExpression[] = [];
        for (const val of values) {
            const x = new SubExpression(expression);
            const accountVar = x.variables.find((v) => v.resource === resourceId);
            if (accountVar) {
                accountVar.replace(val);
            }
            result.push(x);
        }
        return result;
    }
}
