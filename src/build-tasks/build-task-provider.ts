import path from 'path';
import { updateAccountResources, updateTemplate } from '../..';
import { OrgFormationError } from '../org-formation-error';
import { IBuildTask, IConfiguredBuildTask } from './build-configuration';

export class BuildTaskProvider {

    public static createBuildTask(filePath: string, name: string, configuration: IConfiguredBuildTask): IBuildTask {
        switch (configuration.Type) {
            case 'update-stacks':
                return new UpdateStacksTask(filePath, name, configuration);

            case 'update-organization':
                return new UpdateOrganization(filePath, name, configuration);

            case 'include':
                throw new OrgFormationError('type include not implemented');

            case  'include-dir':
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
    private config: IConfiguredBuildTask;

    constructor(filePath: string, name: string, config: IConfiguredBuildTask) {
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
        return await updateAccountResources(this.templatePath, {...command, stackName: this.stackName} as any );
    }

}

class UpdateOrganization implements IBuildTask {

    public name: string;
    public type: string;
    public done: boolean;
    public dependsOn: string;
    public stackName: string;
    public templatePath: string;
    private config: IConfiguredBuildTask;

    constructor(filePath: string, name: string, config: IConfiguredBuildTask) {
        this.name = name;
        this.done = false;
        this.type = config.Type;
        this.dependsOn = config.DependsOn;
        this.stackName = config.StackName;
        this.config = config;
        const dir = path.dirname(filePath);
        this.templatePath =  path.join(dir, config.Template);

    }
    public async perform(command: any): Promise<boolean> {
        console.log(`executing: ${this.config.Type} ${this.templatePath}`);
        return await updateTemplate(this.templatePath, command );
    }

}
