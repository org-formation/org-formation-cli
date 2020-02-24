import { OrgFormationError } from '../../org-formation-error';
import { IResource, TemplateRoot } from '../parser';
import { Validator } from '../validator';
import { Resource } from './resource';

export interface IPasswordPolicyProperties {
    MaxPasswordAge?: number;
    MinimumPasswordLength?: number;
    RequireLowercaseCharacters?: boolean;
    RequireNumbers?: boolean;
    RequireSymbols?: boolean;
    RequireUppercaseCharacters?: boolean;
    PasswordReusePrevention?: number;
    AllowUsersToChangePassword?: boolean;
}

export class PasswordPolicyResource extends Resource {
    public maxPasswordAge?: number;
    public minimumPasswordLength?: number;
    public requireLowercaseCharacters?: boolean;
    public requireNumbers?: boolean;
    public requireSymbols?: boolean;
    public requireUppercaseCharacters?: boolean;
    public passwordReusePrevention?: number;
    public allowUsersToChangePassword?: boolean;
    private props: IPasswordPolicyProperties;

    constructor(root: TemplateRoot, id: string, resource: IResource) {
        super(root, id, resource);

        if (resource.Properties === undefined) {
            throw new OrgFormationError(`Properties are missing for resource ${id}`);
        }

        this.props = this.resource.Properties as IPasswordPolicyProperties;
        this.maxPasswordAge = this.props.MaxPasswordAge;
        if (this.maxPasswordAge !== undefined) {
            Validator.validatePositiveInteger(this.maxPasswordAge, 'MaxPasswordAge');
            if (this.maxPasswordAge < 1) {
                throw new OrgFormationError(`MaxPasswordAge for resource ${id} must have value greater than or equal to 1`);
            }
         }
        this.minimumPasswordLength = this.props.MinimumPasswordLength;
        if (this.minimumPasswordLength !== undefined) {
            Validator.validatePositiveInteger(this.maxPasswordAge, 'MinimumPasswordLength');
            if (this.minimumPasswordLength < 6) {
                throw new OrgFormationError(`MinimumPasswordLength for resource ${id} must have value greater than or equal to 6`);
            }
            if (this.minimumPasswordLength > 128) {
                throw new OrgFormationError(`MinimumPasswordLength for resource ${id} must have value smaller than or equal to 128`);
            }
        }
        this.requireLowercaseCharacters = this.props.RequireLowercaseCharacters;
        this.requireNumbers = this.props.RequireNumbers;
        this.requireSymbols = this.props.RequireSymbols;
        this.requireUppercaseCharacters = this.props.RequireUppercaseCharacters;
        this.passwordReusePrevention = this.props.PasswordReusePrevention;
        if (this.passwordReusePrevention !== undefined) {
            Validator.validatePositiveInteger(this.maxPasswordAge, 'PasswordReusePrevention');
            if (this.passwordReusePrevention < 1) {
                throw new OrgFormationError(`PasswordReusePrevention for resource ${id} must have value greater than or equal to 1`);
            }
            if (this.passwordReusePrevention > 24) {
                throw new OrgFormationError(`PasswordReusePrevention for resource ${id} must have value smaller than or equal to 24`);
            }
        }
        this.allowUsersToChangePassword = this.props.AllowUsersToChangePassword;

        super.throwForUnknownAttributes(resource, id, 'Type', 'Properties');
        super.throwForUnknownAttributes(this.props, id, 'MaxPasswordAge', 'MinimumPasswordLength', 'AllowUsersToChangePassword', 'RequireLowercaseCharacters', 'RequireNumbers', 'RequireSymbols', 'RequireUppercaseCharacters', 'PasswordReusePrevention');
    }
}
