import { PersistedState } from "~state/persisted-state";
import Sinon = require("sinon");
import { S3StorageProvider, IStorageProvider } from "~state/storage-provider";

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

        state.setBindingPhysicalId('myType', 'logical-id-1', 'physical-id-2');
    });


    test('put binding can be read', () => {
        const binding = state.getBinding('myType', 'logical-id-1');
        expect(binding).toBeDefined();
        expect(binding.physicalId).toBe('physical-id-2')
    })

    test('put binding has undefined hash', () => {
        const binding = state.getBinding('myType', 'logical-id-1');
        expect(binding.lastCommittedHash).toBeUndefined();
    });
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


        state.setBindingPhysicalId('myType', 'logical-id-1', 'physical-id-2');
    });


    test('put binding can be read', () => {
        const binding = state.getBinding('myType', 'logical-id-1');
        expect(binding).toBeDefined();
        expect(binding.physicalId).toBe('physical-id-2')
    })

    test('binding keeps hash', () => {
        const binding = state.getBinding('myType', 'logical-id-1');
        expect(binding.lastCommittedHash).toBe('23123');
    });
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
