import { CloudFormationBinder, ICfnBinding } from '~cfn-binder/cfn-binder';
import { OrgResourceTypes } from '~parser/model/resource-types';
import { TemplateRoot } from '~parser/parser';
import { PersistedState } from '~state/persisted-state';
import { ICfnTemplate } from '../cfn-types';

describe('when loading template with default-bindings', () => {
    let template: TemplateRoot;
    let cloudformationBinder: CloudFormationBinder;
    let bindings: ICfnBinding[];

    beforeEach(async () => {
        template = TemplateRoot.create('./test/resources/defaults/default-binding.yml');
        const persistedState = PersistedState.CreateEmpty(template.organizationSection.masterAccount.accountId);

        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '000000000000', logicalId: 'MasterAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '111111111111', logicalId: 'Account1', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '222222222222', logicalId: 'Account2', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '333333333333', logicalId: 'Account3', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '444444444444', logicalId: 'Account4', lastCommittedHash: 'abc'});

        cloudformationBinder = new CloudFormationBinder('default-binding', template, persistedState);
        bindings = await cloudformationBinder.enumBindings();
    });

    test('2 bindings are created', () => {
        expect(bindings).toBeDefined();
        expect(bindings.length).toBe(2);
    });

    test('topic is created in acc 1 and region eu-west-1', () => {
        const bindingAcc1 = bindings.find((x) => x.accountId === '111111111111');
        const templateAcc1 = JSON.parse(bindingAcc1.template.createTemplateBody()) as ICfnTemplate;
        expect(bindingAcc1.region).toBe('eu-west-1');
        expect(templateAcc1.Resources.Topic).toBeDefined();

    });

    test('s3 bucket is created in acc 2 and region eu-central-1', () => {
        const bindingAcc1 = bindings.find((x) => x.accountId === '222222222222');
        const templateAcc1 = JSON.parse(bindingAcc1.template.createTemplateBody()) as ICfnTemplate;
        expect(bindingAcc1.region).toBe('eu-central-1');
        expect(templateAcc1.Resources.S3Bucket).toBeDefined();

    });
});

describe('when loading template with default-regions', () => {
    let template: TemplateRoot;
    let cloudformationBinder: CloudFormationBinder;
    let bindings: ICfnBinding[];

    beforeEach(async () => {
        template = TemplateRoot.create('./test/resources/defaults/default-regions.yml');
        const persistedState = PersistedState.CreateEmpty(template.organizationSection.masterAccount.accountId);

        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '000000000000', logicalId: 'MasterAccount', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '111111111111', logicalId: 'Account1', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '222222222222', logicalId: 'Account2', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '333333333333', logicalId: 'Account3', lastCommittedHash: 'abc'});
        persistedState.setBinding({type: OrgResourceTypes.Account, physicalId: '444444444444', logicalId: 'Account4', lastCommittedHash: 'abc'});

        cloudformationBinder = new CloudFormationBinder('default-regions', template, persistedState);
        bindings = await cloudformationBinder.enumBindings();
    });

    test('3 bindings are created', () => {
        expect(bindings).toBeDefined();
        expect(bindings.length).toBe(3);
    });

    test('topic is created in acc 1 and region eu-west-1 and eu-central-1', () => {
        const bindingAccEuWest1 = bindings.find((x) => x.accountId === '111111111111' && x.region === 'eu-west-1' );
        const templateAccEuWest1 = JSON.parse(bindingAccEuWest1.template.createTemplateBody()) as ICfnTemplate;
        expect(templateAccEuWest1.Resources.Topic).toBeDefined();

        const bindingAccEuCentral1 = bindings.find((x) => x.accountId === '111111111111' && x.region === 'eu-central-1' );
        const templateAccEuCentral1 = JSON.parse(bindingAccEuCentral1.template.createTemplateBody()) as ICfnTemplate;
        expect(templateAccEuCentral1.Resources.Topic).toBeDefined();
    });

    test('s3 bucket is created in acc 1 and region eu-west-1', () => {
        const bindingAcc1 = bindings.find((x) => x.accountId === '111111111111' && x.region === 'us-east-1');
        const templateAcc1 = JSON.parse(bindingAcc1.template.createTemplateBody()) as ICfnTemplate;
        expect(templateAcc1.Resources.S3Bucket).toBeDefined();

    });
});
