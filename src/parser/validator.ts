import { OrgFormationError } from "../org-formation-error";

export class Validator {
    public static ThrowForUnknownAttribute(obj: any, id: string, ...knownAttributes: string[]) {
        for (const att in obj) {
            if (knownAttributes.indexOf(att) < 0) {
                throw new OrgFormationError(`unknown attribute ${att} found on ${id}`);
            }
        }
    }
}
