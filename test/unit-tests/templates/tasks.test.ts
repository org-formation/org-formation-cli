import { expect } from 'chai';
import { BuildConfiguration, IBuildTask } from '../../../src/build-tasks/build-configuration';
import { BaseOrganizationTask, BaseStacksTask } from '../../../src/build-tasks/build-task-provider';
import { ICommandArgs } from '../../../src/commands/base-command';

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

describe('when getting build tasks for task file without update-organization', () => {

    it('then error is thrown', () => {
        try {
            const config = new BuildConfiguration('./test/resources/tasks/build-tasks-empty.yml');
            config.enumBuildTasks({} as ICommandArgs);
            throw new Error('expected error to have been thrown');
        } catch (err) {
            expect(err.message).to.contain('update-organization');
        }
    });
});

describe('when getting validation tasks for task file without update-organization', () => {

    it('then error is thrown', () => {
        try {
            const config = new BuildConfiguration('./test/resources/tasks/build-tasks-empty.yml');
            config.enumValidationTasks({} as ICommandArgs);
            throw new Error('expected error to have been thrown');
        } catch (err) {
            expect(err.message).to.contain('update-organization');
        }
    });
});

describe('when getting validation tasks for task file with duplicate stackName', () => {

    it('then error is thrown', () => {
        try {
            const config = new BuildConfiguration('./test/resources/tasks/build-tasks-duplicate-stackname.yml');
            config.enumValidationTasks({} as ICommandArgs);
            throw new Error('expected error to have been thrown');
        } catch (err) {
            expect(err.message).to.contain('stackName');
            expect(err.message).to.contain('stack-name');
        }
    });
});

describe('when getting build tasks for task file with duplicate stackName', () => {

    it('then error is thrown', () => {
        try {
            const config = new BuildConfiguration('./test/resources/tasks/build-tasks-duplicate-stackname.yml');
            config.enumBuildTasks({} as ICommandArgs);
            throw new Error('expected error to have been thrown');
        } catch (err) {
            expect(err.message).to.contain('stackName');
            expect(err.message).to.contain('stack-name');
        }
    });
});

describe('when including task file without update-organization', () => {
    let buildconfig: BuildConfiguration;

    beforeEach(() => {
        buildconfig = new BuildConfiguration('./test/resources/tasks/build-tasks-include-empty.yml');
    });

    it('file is loaded without errors', () => {
        const tasks = buildconfig.enumBuildTasks({} as any);
        expect(tasks).to.not.be.undefined;
        expect(tasks.length).to.eq(2);
        expect(tasks.filter((x) => x.type === 'include').length).to.eq(1);
        expect(tasks.filter((x) => x.type === 'update-organization').length).to.eq(1);
    });

    it('organization file path is passed to included file ', () => {
        const tasks = buildconfig.enumBuildTasks({} as any);
        const includeTask = tasks.filter((x) => x.type === 'include')[0];
        const updateOrgTask = tasks.filter((x) => x.type === 'update-organization')[0];
        const command = (includeTask as any).command;
        expect(command).to.not.be.undefined;
        expect(command.organizationFile).to.not.be.undefined;
        expect(command.organizationFile as string).to.contain((updateOrgTask as BaseOrganizationTask).templatePath);

    });
});

describe('when referencing account on parameter', () => {
    let buildconfig: BuildConfiguration;
    let tasks: IBuildTask[];

    beforeEach(() => {
        buildconfig = new BuildConfiguration('./test/resources/tasks/build-tasks-param-account-ref.yml');
        tasks = buildconfig.enumBuildTasks({} as any);
    });

    it('file is loaded without errors', () => {
        expect(tasks).to.not.be.undefined;
        expect(tasks.length).to.eq(3);
        const updateStacks = tasks.filter((x) => x.type === 'update-stacks');
        expect(updateStacks.length).to.eq(2);
    });

    // it('physical id of account is copied to parameter value', () => {
    //     const updateStacksAccount1 = tasks.filter((x) => x.type === 'update-stacks' && x.name === 'StackParamAccount1Ref')[0] as BaseStacksTask;

    //     expect(updateStacksAccount1);
    // });
});
