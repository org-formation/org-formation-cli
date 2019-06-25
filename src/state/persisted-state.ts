import { readFileSync, stat, writeFileSync } from "fs";

export class PersistedState {
    private filename: string;
    private state: IState;
    private dirty: boolean;

    constructor(state: IState, filename: string = 'state.json') {
        this.filename = filename;
        this.state = state;
    }

    getBinding(type: string, logicalId: string): IBinding {
        const typeDict = this.state.bindings[type];
        if (!typeDict) return undefined;

        return typeDict[logicalId];
    }

    enumBindings(type: string): IBinding[] {
        const typeDict = this.state.bindings[type];
        if (!typeDict) return [];

        const result = [];
        for(const key in typeDict) {
            result.push(typeDict[key]);
        }
        return result;
    }

    setBinding(binding: IBinding) {
        let typeDict: Record<string, IBinding> = this.state.bindings[binding.type];
        if (!typeDict) {
            typeDict = this.state.bindings[binding.type] = {}
        }

        typeDict[binding.logicalId]  = binding;
        this.dirty = true;
    }

    save(filename: string = this.filename) {
        if (!this.dirty) return;
        const json = JSON.stringify(this.state, null, 2);
        writeFileSync(filename, json, {encoding: 'utf8'});
    }

    static Load(path: string): PersistedState {
        const buff = readFileSync(path);
        const json = buff.toString('utf8');
        const state = JSON.parse(json) as IState;
        return new PersistedState(state, path);
    }

    static CreateEmpty(masterAccountId: string) {
        return new PersistedState({
            masterAccountId: masterAccountId,
            bindings: {}
        });
    }
}

export interface IState {
    masterAccountId: string;
    bindings: Record<string, Record<string, IBinding>>;
}

export interface IBinding {
    logicalId: string;
    type: string;
    lastCommittedHash: string;
    physicalId: string;
}