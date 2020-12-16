export class OrgFormationError extends Error {
    constructor(message: string, public readonly code: ErrorCode = ErrorCode.Unknown) {
        super(message);
    }


}


export enum ErrorCode {
    Unknown,
    FailureToRemove
}
