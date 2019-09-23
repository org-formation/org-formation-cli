import { S3 } from 'aws-sdk';
import { CreateBucketRequest, GetObjectRequest, PutObjectRequest } from 'aws-sdk/clients/s3';
import { readFileSync, stat, writeFileSync } from 'fs';
import { OrgFormationError } from '../org-formation-error';
import {IStorageProvider} from './storage-provider';

export class PersistedState {

    public static async Load(provider: IStorageProvider): Promise<PersistedState> {

        try {
            const contents = await provider.get();
            let object = {} as IState;
            if (contents && contents.trim().length > 0) {
                object = JSON.parse(contents);
            }

            if (object.stacks === undefined) {
                object.stacks = {};
            }
            if (object.bindings === undefined) {
                object.bindings = {};
            }
            return new PersistedState(object, provider);
        } catch (err) {
            if (err instanceof SyntaxError) {
                throw new OrgFormationError(`unable to parse state file ${err}`);
            }
            throw err;
        }

    }

    public static CreateEmpty(masterAccountId: string) {
        return new PersistedState({
            masterAccountId,
            bindings: {},
            stacks: {},
            previousTemplate: '',
        }, null);
    }

    public readonly masterAccount: string;
    private provider: IStorageProvider;
    private state: IState;
    private dirty: boolean = false;

    constructor(state: IState, provider: IStorageProvider) {
        this.provider = provider;
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

    public enumTargets(stackName: string): ICfnTarget[] {
        const stacks = this.state.stacks;
        if (!stacks) { return []; }

        const result: ICfnTarget[] = [];
        for (const stack in stacks) {
            if (stack !== stackName) { continue; }
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
        const accounts = this.state.stacks[stackName];
        if (!accounts) {
            return;
        }
        const regions: Record<string, ICfnTarget> = accounts[accountId];
        if (!regions) {
            return;
        }

        delete regions[region];

        if (Object.keys(regions).length === 0) {
            delete accounts[accountId];

            if (Object.keys(accounts).length === 0) {
                delete this.state.stacks[stackName];
            }
        }

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

    public async save(storageProvider: IStorageProvider = this.provider) {
        if (!this.dirty) { return; }

        const json = JSON.stringify(this.state, null, 2);
        await storageProvider.put(json);

        this.dirty = false;
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
