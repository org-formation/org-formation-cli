import { expect } from 'chai';
import { BuildConfiguration } from '../../../src/build-tasks/build-configuration';

describe('when loading task file configuration', () => {
    let buildconfig: BuildConfiguration;

    beforeEach(() => {
        buildconfig = new BuildConfiguration('./test/resources/tasks/build-tasks.yml');
    });

    it('loads build configuration', () => {
        expect(buildconfig).to.not.be.undefined;
    });

    it('has configuration per task', () => {
        expect(buildconfig.tasks.length).to.eq(5);
        expect(buildconfig.tasks.find((x) => x.LogicalName === 'CfnTemplate')).to.not.be.undefined;
        expect(buildconfig.tasks.find((x) => x.LogicalName === 'OrgTemplate')).to.not.be.undefined;
        expect(buildconfig.tasks.find((x) => x.LogicalName === 'OrganizationUpdate')).to.not.be.undefined;
        expect(buildconfig.tasks.find((x) => x.LogicalName === 'Include1')).to.not.be.undefined;
        expect(buildconfig.tasks.find((x) => x.LogicalName === 'Include2')).to.not.be.undefined;
    });

    it('all tasks have FilePath', () => {
        const withoutFileName = buildconfig.tasks.find((x) => !x.FilePath);
        expect(withoutFileName).to.be.undefined;
    });
});

describe('when enumerating build tasks', () => {
    let buildconfig: BuildConfiguration;

    beforeEach(() => {
        buildconfig = new BuildConfiguration('./test/resources/tasks/build-tasks.yml');
    });

    it('every build config gets a task', () => {
        const tasks = buildconfig.enumBuildTasks({} as any);
        expect(tasks).to.not.be.undefined;
        expect(tasks.length).to.eq(5);
        expect(tasks.filter((x) => x.type === 'include').length).to.eq(2);
        expect(tasks.filter((x) => x.type === 'update-stacks').length).to.eq(2);
        expect(tasks.filter((x) => x.type === 'update-organization').length).to.eq(1);
    });
});
