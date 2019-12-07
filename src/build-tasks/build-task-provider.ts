import path from 'path';
import { IUpdateStackCommandArgs, updateAccountResources, updateTemplate } from '../..';
import { OrgFormationError } from '../org-formation-error';
import { IBuildTask, IConfiguratedUpdateStackBuildTask, IConfiguredBuildTask } from './build-configuration';

export class BuildTaskProvider {

    public static createBuildTask(filePath: string, name: string, configuration: IConfiguredBuildTask): IBuildTask {
        switch (configuration.Type) {
            case 'update-stacks':
                return new UpdateStacksTask(filePath, name, configuration as IConfiguratedUpdateStackBuildTask);

            case 'update-organization':
                return new UpdateOrganization(filePath, name, configuration);

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
    public type: string;
    public done: boolean;
    public dependsOn: string;
    public stackName: string;
    public templatePath: string;
    private config: IConfiguratedUpdateStackBuildTask;

    constructor(filePath: string, name: string, config: IConfiguratedUpdateStackBuildTask) {
        if (config.Template === undefined) {
            throw new Error(`Required atrribute Template missing for task ${name}`);
        }
        if (config.StackName === undefined) {
            throw new Error(`Required atrribute StackName missing for task ${name}`);
        }
        this.name = name;
        this.done = false;
        this.dependsOn = config.DependsOn;
        this.stackName = config.StackName;
        this.type = config.Type;
        this.config = config;
        const dir = path.dirname(filePath);
        this.templatePath =  path.join(dir, config.Template);

    }
    public async perform(command: any): Promise<boolean> {
        console.log(`executing: ${this.config.Type} ${this.templatePath} ${this.stackName}`);
        const args: IUpdateStackCommandArgs = {
            ...command,
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

        if (this.config.TerminationProtection) {
            args.terminationProtection = this.config.TerminationProtection;
        }

        const result =  await updateAccountResources(this.templatePath, args);
        this.done = true;
        return result;
    }

}

class UpdateOrganization implements IBuildTask {

    public name: string;
    public type: string;
    public done: boolean;
    public dependsOn: string;
    public templatePath: string;
    private config: IConfiguredBuildTask;

    constructor(filePath: string, name: string, config: IConfiguredBuildTask) {
        this.name = name;
        this.done = false;
        this.type = config.Type;
        this.dependsOn = config.DependsOn;
        this.config = config;
        const dir = path.dirname(filePath);
        this.templatePath =  path.join(dir, config.Template);

    }
    public async perform(command: any): Promise<boolean> {
        console.log(`executing: ${this.config.Type} ${this.templatePath}`);
        const result = await updateTemplate(this.templatePath, command );
        this.done = true;
        return result;
    }

}
