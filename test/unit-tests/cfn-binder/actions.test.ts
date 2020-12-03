import { CloudFormationBinder, ICfnBinding } from '~cfn-binder/cfn-binder';
import { OrgResourceTypes } from '~parser/model/resource-types';
import { TemplateRoot } from '~parser/parser';
import { PersistedState } from '~state/persisted-state';
import { TestTemplates } from '../test-templates';

const templateRoot = TestTemplates.createBasicTemplate({
    resource: {
        Type: 'AWS::Custom',
        Properties: {
            Whatever: 'Value',
        },
        OrganizationBinding: {
            Region: 'eu-central-1',
            Account: [
                { Ref: 'Account' },
                { Ref: 'Account2' },
            ],
        },
    },
});


const templateRootWithResolve = TestTemplates.createBasicTemplate({
    resource: {
        Type: 'AWS::Custom',
        Properties: {
            Whatever: 'Value',
            Now: {
                This: [
                    {
                        Contains: {
                            Something: '{{resolve::ssm-something}}'
                        }
                    }
                ]
            }

        },
        OrganizationBinding: {
            Region: 'eu-central-1',
            Account: [
                { Ref: 'Account' },
                { Ref: 'Account2' },
            ],
        },
    },
});



describe('when binding templates not in state', () => {
    let binder: CloudFormationBinder;
    let bindings: ICfnBinding[];

    beforeEach(async () => {

        const state = PersistedState.CreateEmpty(templateRoot.organizationSection.masterAccount.accountId);
        state.setBinding({ logicalId: 'Account', physicalId: '123123123123', type: OrgResourceTypes.Account, lastCommittedHash: 'asd' });
        state.setBinding({ logicalId: 'Account2', physicalId: '123123123124', type: OrgResourceTypes.Account, lastCommittedHash: 'asd' });

        binder = new CloudFormationBinder('test-stack', templateRoot, state);
        bindings = await binder.enumBindings();
    });


    test('then all actions are set to UpdateOrCreate', () => {
        expect(bindings.length).toBe(2);
        expect(bindings[0].action).toBe('UpdateOrCreate');
        expect(bindings[1].action).toBe('UpdateOrCreate');
    });
});

describe('when binding templates that did not change', () => {
    let binder: CloudFormationBinder;
    let bindings: ICfnBinding[];
    let state: PersistedState;
    beforeEach(async () => {

        state = PersistedState.CreateEmpty(templateRoot.organizationSection.masterAccount.accountId);

        state.setBinding({ logicalId: 'Account', physicalId: '123123123123', type: OrgResourceTypes.Account, lastCommittedHash: 'asd' });
        state.setBinding({ logicalId: 'Account2', physicalId: '123123123124', type: OrgResourceTypes.Account, lastCommittedHash: 'asd' });

        state.setTarget({ stackName: 'test-stack', accountId: '123123123123', region: 'eu-central-1', logicalAccountId: 'Account', lastCommittedHash: '1babbbaa897bd1ffa6ad2f9e82e26fe2' })
        state.setTarget({ stackName: 'test-stack', accountId: '123123123124', region: 'eu-central-1', logicalAccountId: 'Account2', lastCommittedHash: '1babbbaa897bd1ffa6ad2f9e82e26fe2' })

    });

    test('then all actions are set to None', async () => {

        binder = new CloudFormationBinder('test-stack', templateRoot, state);
        bindings = await binder.enumBindings();

        expect(bindings.length).toBe(2);
        expect(bindings[0].action).toBe('None');
        expect(bindings[1].action).toBe('None');
    });

    test('then forceDeploy will change actions to UpdateOrCreate', async () => {
        binder = new CloudFormationBinder('test-stack', templateRoot, state, {}, true);
        bindings = await binder.enumBindings();

        expect(bindings.length).toBe(2);
        expect(bindings[0].action).toBe('UpdateOrCreate');
        expect(bindings[1].action).toBe('UpdateOrCreate');
    });

    test('then parameter with resolve expression will change actions to UpdateOrCreate', async () => {
        binder = new CloudFormationBinder('test-stack', templateRoot, state, { 'paramKey': '{{resolve:secretsmanager:arn:xxxx}}' });
        bindings = await binder.enumBindings();

        expect(bindings.length).toBe(2);
        expect(bindings[0].action).toBe('UpdateOrCreate');
        expect(bindings[1].action).toBe('UpdateOrCreate');
    });

    test('then parameter with resolve expression and explicit forceDeploy to false will leave actions to None', async () => {
        binder = new CloudFormationBinder('test-stack', templateRoot, state, { 'paramKey': '{{resolve:secretsmanager:arn:xxxx}}' }, false);
        bindings = await binder.enumBindings();

        expect(bindings.length).toBe(2);
        expect(bindings[0].action).toBe('UpdateOrCreate');
        expect(bindings[1].action).toBe('UpdateOrCreate');
    });


    test('then template with resolve expression will change actions to UpdateOrCreate', async () => {
        binder = new CloudFormationBinder('test-stack', templateRootWithResolve, state);
        bindings = await binder.enumBindings();

        expect(bindings.length).toBe(2);
        expect(bindings[0].action).toBe('UpdateOrCreate');
        expect(bindings[1].action).toBe('UpdateOrCreate');
    });

    test('then template with resolve expression and explicit forceDeploy to false will leave actions to None', async () => {
        binder = new CloudFormationBinder('test-stack', templateRootWithResolve, state, { }, false);
        bindings = await binder.enumBindings();

        expect(bindings.length).toBe(2);
        expect(bindings[0].action).toBe('UpdateOrCreate');
        expect(bindings[1].action).toBe('UpdateOrCreate');
    });
});
