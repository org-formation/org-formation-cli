import { OrgFormationError } from '../org-formation-error';

export class CfnParameters {
    static ParseParameterValues(commandParameters: string): Record<string, string> {
        if (commandParameters === undefined || commandParameters === '') {
            return {};
        }
        const parameters: Record<string, string> = {};
        const parameterParts = commandParameters.split(' ');
        for (const parameterPart of parameterParts) {
            const parameterAttributes = parameterPart.split(',');
            if (parameterAttributes.length === 1) {
                const parts = parameterAttributes[0].split('=');
                if (parts.length !== 2) {
                    throw new OrgFormationError(`error reading parameter ${parameterAttributes[0]}. Expected either key=val or ParameterKey=key,ParameterValue=val.`);
                }
                parameters[parts[0]] = parts[1];
            } else {
                const key = parameterAttributes.find(x => x.startsWith('ParameterKey='));
                const value = parameterAttributes.find(x => x.startsWith('ParameterValue='));
                if (key === undefined || value === undefined) {
                    throw new OrgFormationError(`error reading parameter ${parameterAttributes[0]}. Expected ParameterKey=key,ParameterValue=val`);
                }
                const paramKey = key.substr(13);
                const paramVal = value.substr(15);
                parameters[paramKey] = paramVal;
            }
        }

        return parameters;
    }
}
