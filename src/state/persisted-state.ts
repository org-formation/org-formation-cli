import { readFileSync, stat, writeFileSync } from 'fs';

export class PersistedState {

    public static Load(path: string): PersistedState {
        let json = '';
        try {
            json = readFileSync(path).toString('utf8');
        } catch (err) {
            if (err.code === 'ENOENT') {
                json = '{}';
            } else {
                throw err;
            }
        }
        const state = JSON.parse(json) as IState;
        if (state.stacks === undefined) {
            state.stacks = {};
        }
        if (state.bindings === undefined) {
            state.bindings = {};
        }
        return new PersistedState(state, path);
    }

    public static CreateEmpty(masterAccountId: string) {
        return new PersistedState({
            masterAccountId,
            bindings: {},
            stacks: {},
            previousTemplate: '',
        });
    }

    public readonly masterAccount: string;
    private filename: string;
    private state: IState;
    private dirty: boolean;

    constructor(state: IState, filename: string = 'state.json') {
        this.filename = filename;
        this.state = state;
        this.masterAccount = state.masterAccountId;
    }

    public getTarget(stackName: string, accountId: string, region: string): ICfnTarget {
        const accounts = this.state.stacks[stackName];
        if (!accounts) { return undefined; }

        const regions = accounts[accountId];
        if (!regions) { return undefined; }

        return regions[region];
    }

    public setTarget(templateTarget: ICfnTarget) {
        let accounts = this.state.stacks[templateTarget.stackName];
        if (!accounts) {
            accounts = this.state.stacks[templateTarget.stackName] = {};
        }
        let regions: Record<string, ICfnTarget> = accounts[templateTarget.accountId];
        if (!regions) {
            regions = accounts[templateTarget.accountId] = {};
        }

        regions[templateTarget.region]  = templateTarget;
        this.dirty = true;
    }

    public enumTargets(): ICfnTarget[] {
        const stacks = this.state.stacks;
        if (!stacks) { return []; }

        const result: ICfnTarget[] = [];
        for (const stack in stacks) {
            const accounts = stacks[stack];
            for (const account in accounts) {
                const regions = accounts[account];
                for (const region in regions) {
                    result.push(regions[region]);
                }
            }
        }
        return result;
    }
    public removeTarget(stackName: string, accountId: string, region: string) {
        throw new Error('Method not implemented.');
    }

    public getBinding(type: string, logicalId: string): IBinding {
        const typeDict = this.state.bindings[type];
        if (!typeDict) { return undefined; }

        return typeDict[logicalId];
    }

    public enumBindings(type: string): IBinding[] {
        const typeDict = this.state.bindings[type];
        if (!typeDict) { return []; }

        const result: IBinding[] = [];
        for (const key in typeDict) {
            result.push(typeDict[key]);
        }
        return result;
    }

    public setBinding(binding: IBinding) {
        let typeDict: Record<string, IBinding> = this.state.bindings[binding.type];
        if (!typeDict) {
            typeDict = this.state.bindings[binding.type] = {};
        }

        typeDict[binding.logicalId]  = binding;
        this.dirty = true;
    }

    public removeBinding(binding: IBinding) {
        let typeDict: Record<string, IBinding> = this.state.bindings[binding.type];
        if (!typeDict) {
            typeDict = this.state.bindings[binding.type] = {};
        }

        delete typeDict[binding.logicalId];
        this.dirty = true;
    }

    public setPreviousTemplate(template: string) {
        this.state.previousTemplate = template;
        this.dirty = true;
    }

    public getPreviousTemplate(): string {
        return this.state.previousTemplate;
    }
    public save(filename: string = this.filename) {
        if (!this.dirty) { return; }
        const json = JSON.stringify(this.state, null, 2);
        writeFileSync(filename, json, {encoding: 'utf8'});
    }
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
