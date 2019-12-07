import path from 'path';
import { IUpdateStackCommandArgs, updateAccountResources, updateTemplate } from '../..';
import { ConsoleUtil } from '../console-util';
import { OrgFormationError } from '../org-formation-error';
import { BuildTaskType, IBuildTask, IConfiguratedUpdateStackBuildTask, IConfiguredBuildTask } from './build-configuration';

export class BuildTaskProvider {

    public static createBuildTask(filePath: string, name: string, configuration: IConfiguredBuildTask, command: any): IBuildTask {
        switch (configuration.Type) {
            case 'update-stacks':
                return new UpdateStacksTask(filePath, name, configuration as IConfiguratedUpdateStackBuildTask, command);

            case 'update-organization':
                return new UpdateOrganization(filePath, name, configuration, command);

            case 'include':
                throw new OrgFormationError('type include not implemented');

            case 'include-dir':
                throw new OrgFormationError('type include-dir not implemented');

            default:
                throw new OrgFormationError(`unable to loead file ${filePath}, unknown cnofiguration type ${configuration.Type}`);
        }
    }
}

class UpdateStacksTask implements IBuildTask {
    public name: string;
    public type: BuildTaskType;
    public dependsOn: string[];
    public stackName: string;
    public templatePath: string;
    private config: IConfiguratedUpdateStackBuildTask;
    private command: any;

    constructor(filePath: string, name: string, config: IConfiguratedUpdateStackBuildTask, command: any) {
        if (config.Template === undefined) {
            throw new Error(`Required atrribute Template missing for task ${name}`);
        }
        if (config.StackName === undefined) {
            throw new Error(`Required atrribute StackName missing for task ${name}`);
        }
        this.name = name;
        if (typeof config.DependsOn === 'string') {
            this.dependsOn = [config.DependsOn];
        } else {
            this.dependsOn = config.DependsOn;
        }
        this.stackName = config.StackName;
        this.type = config.Type;
        this.config = config;
        const dir = path.dirname(filePath);
        this.templatePath = path.join(dir, config.Template);
        this.command = command;

    }
    public async perform(): Promise<void> {
        ConsoleUtil.LogInfo(`executing: ${this.config.Type} ${this.templatePath} ${this.stackName}`);
        const args: IUpdateStackCommandArgs = {
            ...this.command,
            stackName: this.stackName,
        };
        if (this.config.StackDescription) {
            args.stackDescription = this.config.StackDescription;
        }

        if (this.config.Parameters) {
            (args as any).parameters = this.config.Parameters;
        }

        if (this.config.OrganizationBinding) {
            args.organizationBinding = this.config.OrganizationBinding;
        }

        if (this.config.OrganizationBindingRegion) {
            args.organizationBindingRegion = this.config.OrganizationBindingRegion;
        }

        if (this.config.TerminationProtection !== undefined) {
            args.terminationProtection = this.config.TerminationProtection;
        }

        await updateAccountResources(this.templatePath, args);
    }
    public isDependency(x: IBuildTask) {
        if (x.type === 'update-organization') {
            return true;
        }
        if (this.dependsOn) {
            return this.dependsOn.includes(x.name);
        }
    }
}

class UpdateOrganization implements IBuildTask {

    public name: string;
    public type: BuildTaskType;
    public templatePath: string;
    private config: IConfiguredBuildTask;
    private command: any;

    constructor(filePath: string, name: string, config: IConfiguredBuildTask, command: any) {
        this.name = name;
        this.type = config.Type;
        this.config = config;
        const dir = path.dirname(filePath);
        this.templatePath = path.join(dir, config.Template);
        this.command = command;

    }
    public async perform(): Promise<void> {
        console.log(`executing: ${this.config.Type} ${this.templatePath}`);
        await updateTemplate(this.templatePath, this.command);
    }
    public isDependency(task: IBuildTask) {
        return false;
    }
}
