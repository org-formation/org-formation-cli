import { OrgFormationError } from '../org-formation-error';

const parameterRe = /ParameterKey=(.*),ParameterValue=(.*)/;

export class CfnParameters {

    static ParseParameterValues(commandParameters: string): Record<string, string> {
        if (commandParameters === undefined || commandParameters === '') {
            return {};
        }
        const parameters: Record<string, string> = {};
        const parameterParts = commandParameters.split(' ');
        for (const parameterPart of parameterParts) {
            const match = parameterPart.match(parameterRe);
            if (match) {
                parameters[match[1]] = this.normalizeValue(match[2]);
            } else {
                const parts = parameterPart.split('=');
                if (parts.length !== 2) {
                    throw new OrgFormationError(`error reading parameter ${parameterPart}. Expected either key=val or ParameterKey=key,ParameterValue=val.`);
                }
                parameters[parts[0]] = this.normalizeValue(parts[1]);
            }
        }

        return parameters;
    }

    /**
     * Removed surrounding quotes if present and replace escaped commas with the comma only
     *
     * @param value The parameter value to be normalized
     */
    static normalizeValue(value: string): string {
       let normalized = value;
       if (value.length > 1 && value[0] === '"' && value [value.length - 1] === '"')  {
           normalized = value.substring(1, value.length - 1);
       }
       normalized = normalized.replace('\\,', ',');
       return normalized;
    }
}
