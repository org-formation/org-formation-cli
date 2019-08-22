"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
class PersistedState {
    static Load(path) {
        let json = '';
        try {
            json = fs_1.readFileSync(path).toString('utf8');
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                json = '{}';
            }
            else {
                throw err;
            }
        }
        const state = JSON.parse(json);
        if (state.stacks === undefined) {
            state.stacks = {};
        }
        if (state.bindings === undefined) {
            state.bindings = {};
        }
        return new PersistedState(state, path);
    }
    static CreateEmpty(masterAccountId) {
        return new PersistedState({
            masterAccountId,
            bindings: {},
            stacks: {},
            previousTemplate: '',
        });
    }
    constructor(state, filename = 'state.json') {
        this.filename = filename;
        this.state = state;
        this.masterAccount = state.masterAccountId;
    }
    getTarget(stackName, accountId, region) {
        const accounts = this.state.stacks[stackName];
        if (!accounts) {
            return undefined;
        }
        const regions = accounts[accountId];
        if (!regions) {
            return undefined;
        }
        return regions[region];
    }
    setTarget(templateTarget) {
        let accounts = this.state.stacks[templateTarget.stackName];
        if (!accounts) {
            accounts = this.state.stacks[templateTarget.stackName] = {};
        }
        let regions = accounts[templateTarget.accountId];
        if (!regions) {
            regions = accounts[templateTarget.accountId] = {};
        }
        regions[templateTarget.region] = templateTarget;
        this.dirty = true;
    }
    enumTargets() {
        const stacks = this.state.stacks;
        if (!stacks) {
            return [];
        }
        const result = [];
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
    removeTarget(stackName, accountId, region) {
        throw new Error('Method not implemented.');
    }
    getBinding(type, logicalId) {
        const typeDict = this.state.bindings[type];
        if (!typeDict) {
            return undefined;
        }
        return typeDict[logicalId];
    }
    enumBindings(type) {
        const typeDict = this.state.bindings[type];
        if (!typeDict) {
            return [];
        }
        const result = [];
        for (const key in typeDict) {
            result.push(typeDict[key]);
        }
        return result;
    }
    setBinding(binding) {
        let typeDict = this.state.bindings[binding.type];
        if (!typeDict) {
            typeDict = this.state.bindings[binding.type] = {};
        }
        typeDict[binding.logicalId] = binding;
        this.dirty = true;
    }
    removeBinding(binding) {
        let typeDict = this.state.bindings[binding.type];
        if (!typeDict) {
            typeDict = this.state.bindings[binding.type] = {};
        }
        delete typeDict[binding.logicalId];
        this.dirty = true;
    }
    setPreviousTemplate(template) {
        this.state.previousTemplate = template;
        this.dirty = true;
    }
    getPreviousTemplate() {
        return this.state.previousTemplate;
    }
    save(filename = this.filename) {
        if (!this.dirty) {
            return;
        }
        const json = JSON.stringify(this.state, null, 2);
        fs_1.writeFileSync(filename, json, { encoding: 'utf8' });
    }
}
exports.PersistedState = PersistedState;
//# sourceMappingURL=persisted-state.js.map