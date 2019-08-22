export declare class PersistedState {
    static Load(path: string): PersistedState;
    static CreateEmpty(masterAccountId: string): PersistedState;
    readonly masterAccount: string;
    private filename;
    private state;
    private dirty;
    constructor(state: IState, filename?: string);
    getTarget(stackName: string, accountId: string, region: string): ICfnTarget;
    setTarget(templateTarget: ICfnTarget): void;
    enumTargets(): ICfnTarget[];
    removeTarget(stackName: string, accountId: string, region: string): void;
    getBinding(type: string, logicalId: string): IBinding;
    enumBindings(type: string): IBinding[];
    setBinding(binding: IBinding): void;
    removeBinding(binding: IBinding): void;
    setPreviousTemplate(template: string): void;
    getPreviousTemplate(): string;
    save(filename?: string): void;
}
export interface IState {
    masterAccountId: string;
    bindings: Record<string, Record<string, IBinding>>;
    stacks: Record<string, Record<string, Record<string, ICfnTarget>>>;
    previousTemplate: string;
}
export interface IBinding {
    logicalId: string;
    type: string;
    physicalId: string;
    lastCommittedHash: string;
}
export interface ICfnTarget {
    logicalAccountId: string;
    region: string;
    accountId: string;
    stackName: string;
    lastCommittedHash: string;
}
