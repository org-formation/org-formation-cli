import { PersistedState, IState } from "~state/persisted-state";
import Sinon = require("sinon");
import { S3StorageProvider, IStorageProvider } from "~state/storage-provider";
import { OrgResourceTypes } from "~parser/model";

describe('when creating empty persisted state', () => {
    let emptyState: PersistedState;
    beforeEach(() => {
        emptyState = PersistedState.CreateEmpty('123123123123');
    })

    test('state is dirty', () => {
        expect((emptyState as any).dirty).toBe(true);
    })

    test('master account is set ', () => {
        expect(emptyState.masterAccount).toBe('123123123123');
    })

    test('previous template is empty', () => {
        expect(emptyState.getPreviousTemplate()).toBe('');
    })

    test('can get tracked tasks', () => {
        const tasks = emptyState.getTrackedTasks('default');
        expect(tasks.length).toBe(0);
    })
});

describe('when deserializing empty state', () => {
    let trulyEmptyState: PersistedState;

    beforeEach(() => {
        trulyEmptyState = new PersistedState({} as IState, null);
    });
    test('can get tracked tasks', () => {
        const tasks = trulyEmptyState.getTrackedTasks('default');
        expect(tasks.length).toBe(0);
    });

    test('can get binding', () => {
        const tasks = trulyEmptyState.getBinding('type', 'xxx');
        expect(tasks).toBeUndefined();
    })

    test('can enum bindings', () => {
        const tasks = trulyEmptyState.enumBindings('aaaa')
        expect(tasks.length).toBe(0);
    })
    test('can set bindings', () => {
        trulyEmptyState.setBinding({type: 'type', physicalId: '123123', logicalId: 'xyz', lastCommittedHash: '123'})
    })
    test('can get target', () => {
        const tasks = trulyEmptyState.getTarget('stack', '123123123123', 'region');
        expect(tasks).toBeUndefined();
    })
    test('can set target', () => {
        trulyEmptyState.setTarget({ stackName: 'stack', accountId: '123123123123', region: 'region', logicalAccountId: 'logical', lastCommittedHash: '123123'});
    })
});

describe('when setting previous template', () => {
    let emptyState: PersistedState;
    beforeEach(() => {
        emptyState = PersistedState.CreateEmpty('123123123123');
        (emptyState as any).dirty = false;
        emptyState.setPreviousTemplate('previous');
    })

    test('state is dirty', () => {
        expect((emptyState as any).dirty).toBe(true);
    })

    test('previous template can be read ', () => {
        expect(emptyState.getPreviousTemplate()).toBe('previous');
    })
});

describe('when setting value', () => {
    let emptyState: PersistedState;
    beforeEach(() => {
        emptyState = PersistedState.CreateEmpty('123123123123');
        (emptyState as any).dirty = false;
        emptyState.putValue('key', 'val');
    })

    test('state is dirty', () => {
        expect((emptyState as any).dirty).toBe(true);
    })

    test('value can be read ', () => {
        expect(emptyState.getValue('key')).toBe('val');
    })
});

describe('when saving state that is not dirty', () => {
    let emptyState: PersistedState;
    let storageProvider: IStorageProvider;
    let storageProviderPut: Sinon.SinonStub;

    beforeEach(() => {
        emptyState = PersistedState.CreateEmpty('123123123123');
        (emptyState as any).dirty = false;

        storageProvider = Sinon.createStubInstance(S3StorageProvider);
        storageProviderPut = storageProvider.put as Sinon.SinonStub;
        emptyState.save(storageProvider)
    })

    test('storage provider put is not called', () => {
        expect(storageProviderPut.callCount).toBe(0);
    })
});

describe('when saving state that is dirty', () => {
    let emptyState: PersistedState;
    let storageProvider: IStorageProvider;
    let storageProviderPut: Sinon.SinonStub;

    beforeEach(() => {
        emptyState = PersistedState.CreateEmpty('123123123123');
        storageProvider = Sinon.createStubInstance(S3StorageProvider);
        storageProviderPut = storageProvider.put as Sinon.SinonStub;
        emptyState.save(storageProvider)
    })

    test('storage provider put is called', () => {
        expect(storageProviderPut.callCount).toBe(1);
        const arg0 = storageProviderPut.getCall(0).args[0];
        const arg0Object = JSON.parse(arg0);
        expect(arg0Object).toBeDefined();
    })

    test('state is marked as not dirty', () => {
        expect((emptyState as any).dirty).toBe(false);
    })
});

describe('when setting bindings', () => {
    let state: PersistedState;

    beforeEach(() => {
        state = PersistedState.CreateEmpty('123123123123');
        state.setBinding({
            logicalId: 'logical-id-1',
            type: 'myType',
            physicalId: 'physical-id',
            lastCommittedHash: '23123'
        });

        state.setBinding({
            logicalId: 'logical-id-2',
            type: 'myType',
            physicalId: 'physical-id-2',
            lastCommittedHash: '23123'
        });

        state.setBinding({
            logicalId: 'logical-id-2',
            type: 'myType',
            physicalId: 'physical-id-3',
            lastCommittedHash: '23123'
        });

        state.setBinding({
            logicalId: 'logical-id-3',
            type: 'otherType',
            physicalId: 'physical-id-2',
            lastCommittedHash: '23123'
        });
    })

    test('put binding can be read', () => {
        const binding = state.getBinding('myType', 'logical-id-1');
        expect(binding).toBeDefined();
        expect(binding.physicalId).toBe('physical-id')
    })

    test('put binding overwrites previously set', () => {
        const binding = state.getBinding('myType', 'logical-id-2');
        expect(binding).toBeDefined();
        expect(binding.physicalId).toBe('physical-id-3')
    })

    test('bindings can be enumerated', () => {
        const bindings = state.enumBindings('myType');
        expect(bindings).toBeDefined();
        expect(bindings.length).toBe(2);
    })

    test('bindings can be removed', () => {
        state.removeBinding({
            logicalId: 'logical-id-2',
            type: 'myType',
            physicalId: 'physical-id-2',
            lastCommittedHash: '23123'
        })

        const binding = state.getBinding('myType', 'logical-id-2');
        expect(binding).toBeUndefined();

        const bindings = state.enumBindings('myType');
        expect(bindings.length).toBe(1);
    })


    test('bindings of unset type can be enumerated', () => {
        const bindings = state.enumBindings('whatever');
        expect(bindings.length).toBe(0);
    });

    test('state is marked as dirty', () => {
        expect((state as any).dirty).toBe(true);
    })
});

describe('when setting binding for unique type', () => {
    let state: PersistedState;

    beforeEach(() => {
        state = PersistedState.CreateEmpty('123123123123');
        state.setUniqueBindingForType({
            logicalId: 'logical-id-1',
            type: 'myType',
            physicalId: 'physical-id',
            lastCommittedHash: '23123'
        });

        state.setUniqueBindingForType({
            logicalId: 'logical-id-2',
            type: 'myType',
            physicalId: 'physical-id-2',
            lastCommittedHash: '23123'
        });
    });


    test('put binding can be read', () => {
        const binding = state.getBinding('myType', 'logical-id-2');
        expect(binding).toBeDefined();
        expect(binding.physicalId).toBe('physical-id-2')
    })

    test('put binding overwrites previously set regardless of logical id', () => {
        const binding = state.getBinding('myType', 'logical-id-1');
        expect(binding).toBeUndefined();
    })

    test('state is marked as dirty', () => {
        expect((state as any).dirty).toBe(true);
    })
});

describe('when setting binding physical id', () => {
    let state: PersistedState;

    beforeEach(() => {
        state = PersistedState.CreateEmpty('123123123123');

        state.setBinding({'type': 'myType', 'logicalId': 'logical-id-1', 'lastCommittedHash': '', 'physicalId': 'physical-id-2'});
    });


    test('put binding can be read', () => {
        const binding = state.getBinding('myType', 'logical-id-1');
        expect(binding).toBeDefined();
        expect(binding.physicalId).toBe('physical-id-2')
    })
});

describe('when overwriting binding physical id', () => {
    let state: PersistedState;

    beforeEach(() => {
        state = PersistedState.CreateEmpty('123123123123');
        state.setBinding({
            logicalId: 'logical-id-1',
            type: 'myType',
            physicalId: 'old',
            lastCommittedHash: '23123'
        });


        state.setBinding({'type': 'myType', 'logicalId': 'logical-id-1', 'lastCommittedHash': '', 'physicalId': 'physical-id-2'});
    });


    test('put binding can be read', () => {
        const binding = state.getBinding('myType', 'logical-id-1');
        expect(binding).toBeDefined();
        expect(binding.physicalId).toBe('physical-id-2')
    })
});

describe('when overwriting binding hash', () => {
    let state: PersistedState;

    beforeEach(() => {
        state = PersistedState.CreateEmpty('123123123123');
        state.setBinding({
            logicalId: 'logical-id-1',
            type: 'myType',
            physicalId: '123123123',
            lastCommittedHash: '23123'
        });

        state.setBindingHash('myType', 'logical-id-1', 'hash');
    });


    test('put binding hash can be read', () => {
        const binding = state.getBinding('myType', 'logical-id-1');
        expect(binding).toBeDefined();
        expect(binding.lastCommittedHash).toBe('hash')
    })

    test('put binding keeps physical id', () => {
        const binding = state.getBinding('myType', 'logical-id-1');
        expect(binding.physicalId).toBe('123123123');
    });
});

describe('when setting targets', () => {
    let state: PersistedState;

    beforeEach(() => {
        state = PersistedState.CreateEmpty('123123123123');
        state.setTarget({
            logicalAccountId: 'myAccount',
            region: 'eu-central-1',
            accountId: '111111111111',
            stackName: 'stack',
            terminationProtection: true,
            lastCommittedHash: 'asdasd',
        });
        state.setTarget({
            logicalAccountId: 'myAccount',
            region: 'eu-west-1',
            accountId: '111111111111',
            stackName: 'stack',
            terminationProtection: true,
            lastCommittedHash: 'aaa',
        });
        state.setTarget({
            logicalAccountId: 'myAccount',
            region: 'eu-west-1',
            accountId: '111111111111',
            stackName: 'stack',
            terminationProtection: true,
            lastCommittedHash: 'bbb',
        });
        state.setTarget({
            logicalAccountId: 'myAccount',
            region: 'eu-central-1',
            accountId: '111111111112',
            stackName: 'stack',
            terminationProtection: true,
            lastCommittedHash: 'qwe123',
        });
    });

    test('put target can be read', () => {
        const binding = state.getTarget('stack', '111111111112', 'eu-central-1');
        expect(binding).toBeDefined();
        expect(binding.lastCommittedHash).toBe('qwe123')
    })

    test('put target overwrites previously set', () => {
        const binding = state.getTarget('stack', '111111111111', 'eu-west-1');
        expect(binding).toBeDefined();
        expect(binding.lastCommittedHash).toBe('bbb')
    })

    test('targets can be enumerated', () => {
        const targets = state.enumTargets('stack')
        expect(targets).toBeDefined();
        expect(targets.length).toBe(3);
        const t1 = targets.find(x=> x.region === 'eu-central-1' && x.accountId === '111111111111');
        const t2 = targets.find(x=> x.region === 'eu-central-1' && x.accountId === '111111111112');
        const t3 = targets.find(x=> x.region === 'eu-west-1' && x.accountId === '111111111111');
        expect(t1).toBeDefined();
        expect(t2).toBeDefined();
        expect(t3).toBeDefined();
    })

    test('targets can be removed', () => {
        state.removeTarget('stack', '111111111112', 'eu-central-1');

        const binding = state.getTarget('stack', '111111111112', 'eu-central-1');
        expect(binding).toBeUndefined();

        const targets = state.enumTargets('stack');
        expect(targets.length).toBe(2);
        const t2 = targets.find(x=> x.region === 'eu-central-1' && x.accountId === '111111111112');
        expect(t2).toBeUndefined();
    })


    test('targets of unset stacks can be enumerated', () => {
        const targets = state.enumTargets('whatever');
        expect(targets.length).toBe(0);
    });


    test('state is marked as dirty', () => {
        expect((state as any).dirty).toBe(true);
    })
});


describe('when setting tracked tasks', () => {
    let state: PersistedState;

    beforeEach(() => {
        state = PersistedState.CreateEmpty('123123123123');
        state.setTrackedTasks('default', [
            {logicalName: 'logical1', physicalIdForCleanup: '123123', type: 'xyz'},
            {logicalName: 'logical2', physicalIdForCleanup: '123124', type: 'xyz'}
        ]);
        state.setTrackedTasks('tasksFile2', [
            {logicalName: 'logical1', physicalIdForCleanup: '123121', type: 'xyz'},
            {logicalName: 'logical2', physicalIdForCleanup: '123122', type: 'xyz'}
        ]);
    })

    test('put tasks can be read', () => {
        const trackedTasks = state.getTrackedTasks('default');
        expect(trackedTasks).toBeDefined();
        expect(trackedTasks.length).toBe(2);
        expect(trackedTasks[0].logicalName).toBe('logical1');
        expect(trackedTasks[1].logicalName).toBe('logical2');
    })

    test('state is marked as dirty', () => {
        expect((state as any).dirty).toBe(true);
    })
});


describe('when creating state with detached organization state', () => {
    let state: PersistedState;
    let orgState: PersistedState;

    beforeEach(() => {
        orgState = PersistedState.CreateEmpty('123123123123');
        state = PersistedState.CreateEmpty('123123123123');

        orgState.putTemplateHash('template-hash');
        orgState.putTemplateHashLastPublished('last-published');

        orgState.setBinding({
            logicalId: 'logical-id-1',
            type: OrgResourceTypes.Account,
            physicalId: 'physical-id',
            lastCommittedHash: '23123'
        });

        state.setReadonlyOrganizationState(orgState);
    })

    test('template hash can be read through both states', () => {
        const templateHashOrgState = orgState.getTemplateHash();
        expect(templateHashOrgState).toBe('template-hash');
        const templateHashState = orgState.getTemplateHash();
        expect(templateHashState).toBe('template-hash');

    })

    test('template last published can be read through both states', () => {
        const templateHashLPOrgState = orgState.getTemplateHashLastPublished();
        expect(templateHashLPOrgState).toBe('last-published');
        const templateHashLPState = orgState.getTemplateHashLastPublished();
        expect(templateHashLPState).toBe('last-published');

    })

    test('org state is readonly', () => {
        expect((orgState as any).readonly).toBe(true);
        expect(() => { orgState.putTemplateHash('xxx'); }).toThrow();
        expect(() => { orgState.putTemplateHashLastPublished('yyy'); }).toThrow();

    });

    test('writing binding to org state throws', () => {
        expect(() => { orgState.setBinding({ } as any) }).toThrow();

    })
    test('writing binding through child state throws', () => {
        expect(() => { state.setBinding({ } as any) }).toThrow();

    })

    test('can read organization binding through child', () => {
        const binding = state.getBinding(OrgResourceTypes.Account, 'logical-id-1');
        expect(binding).toBeDefined();
        expect(binding.physicalId).toBe('physical-id')
    })

    test('can list bindings through child', () => {
        const bindings = state.enumBindings(OrgResourceTypes.Account)
        expect(bindings).toBeDefined();
        expect(bindings.length).toBe(1);
    })

    test('can resolve logical id through child', () => {
        const logicalId = state.getLogicalIdForPhysicalId('physical-id')
        expect(logicalId).toBeDefined();
        expect(logicalId).toBe('logical-id-1');
    })

    test('can resolve account through child', () => {
        const acc = state.getAccountBinding('logical-id-1')
        expect(acc).toBeDefined();
        expect(acc.physicalId).toBe('physical-id');
    })
});
