"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Validator {
    static ThrowForUnknownAttribute(obj, id, ...knownAttributes) {
        for (const att in obj) {
            if (knownAttributes.indexOf(att) < 0) {
                throw new Error(`unknown attribute ${att} found on ${id}`);
            }
        }
    }
}
exports.Validator = Validator;
//# sourceMappingURL=validator.js.map