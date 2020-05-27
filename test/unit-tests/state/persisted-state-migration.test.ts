import { PersistedState, IState } from "~state/persisted-state";

const targets= {
  "copy-to-s3": {
    "GuardDutyTrustedIps": {
      "123123123123": {
        "eu-central-1": {
          "targetType": "copy-to-s3",
          "logicalAccountId": "MasterAccount",
          "region": "eu-central-1",
          "accountId": "123123123123",
          "definition": {
            "type": "copy-to-s3",
            "name": "GuardDutyTrustedIps",
            "localPath": "./trusted_ips.txt",
            "remotePath": "s3://mnyp-guardduty-trusted-ips/trusted_ips.txt",
            "hash": "c6f5f25175ecdb88ea8b5b9a53ec7452"
          },
          "logicalName": "GuardDutyTrustedIps",
          "lastCommittedHash": "c6f5f25175ecdb88ea8b5b9a53ec7452"
        }
      }
    },
    "default": {
      "GuardDuty": {
        "GuardDutyTrustedIps": {
          "123123123123": {
            "eu-central-1": {
              "targetType": "copy-to-s3",
              "logicalAccountId": "MasterAccount",
              "region": "eu-central-1",
              "accountId": "123123123123",
              "definition": {
                "type": "copy-to-s3",
                "name": "GuardDutyTrustedIps",
                "localPath": "./trusted_ips.txt",
                "remotePath": "s3://mnyp-guardduty-trusted-ips/trusted_ips.txt",
                "hash": "c6f5f25175ecdb88ea8b5b9a53ec7452",
                "forceDeploy": false,
                "logVerbose": false
              },
              "logicalName": "GuardDutyTrustedIps",
              "logicalNamePrefix": "GuardDuty",
              "organizationLogicalName": "default",
              "lastCommittedHash": "c6f5f25175ecdb88ea8b5b9a53ec7452"
            }
          }
        }
      }
    }
  }
};
const trackedTasks = {
    "default": [
        {
          "physicalIdForCleanup": "my-roles",
          "logicalName": "Roles",
          "type": "update-stacks"
        },
        {
          "physicalIdForCleanup": "my-other",
          "logicalName": "BudgetAlarms",
          "type": "update-stacks"
        }]
};

describe('when loading v1 state and migrating to v2', () => {
    let emptyState: PersistedState;
    let state : IState;
    beforeEach(() => {
        emptyState = PersistedState.CreateEmpty('123123123123');
        state = (emptyState as any).state;
        (state as any).targets = JSON.parse(JSON.stringify(targets));
        state.trackedTasks = JSON.parse(JSON.stringify(trackedTasks));
        emptyState.performUpdateToVersion2IfNeeded();
    })

    test('old targets are removed', () => {
        const targets = (state as any).targets;
        expect(targets['copy-to-s3']['GuardDutyTrustedIps']).toBeUndefined();
        expect((emptyState as any).dirty).toBe(true);
    })
    test('new targets stay removed', () => {
        const targets = (state as any).targets;
        expect(targets['copy-to-s3']['default']['GuardDuty']['GuardDutyTrustedIps']).toBeDefined();
        expect((emptyState as any).dirty).toBe(true);
    })

    test('tracked tasks are removed', () => {
        expect(Object.keys(state.trackedTasks).length).toBe(0);
    })

    test('version is stored', () => {
        expect(emptyState.getValue('state-version')).toBe('2');
    })

    test('will not migrate twice', () => {
        state.trackedTasks = trackedTasks;
        emptyState.performUpdateToVersion2IfNeeded();
        expect(Object.keys(state.trackedTasks.default).length).toBe(2);

    })
});