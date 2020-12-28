import { AwsUtil } from '~util/aws-util';
import { GlobalState } from '~util/global-state';

export interface ICrossAccountAccess {
    role?: string;
    viaRole?: string;
}

export interface ICrossAccountConfig {
    masterAccountId: string;
    masterAccountRoleName: string;
}


export const GetOrganizationAccessRoleInTargetAccount = (config: ICrossAccountConfig, targetAccountId: string): ICrossAccountAccess => {
    if (config.masterAccountId === targetAccountId) {
        if (config.masterAccountRoleName !== undefined) {
            return {
                role: config.masterAccountRoleName,
            };
        }
         else {
             return {
             };
         }
    } else {
        const result: ICrossAccountAccess = {
            role: GlobalState.GetOrganizationAccessRoleName(targetAccountId),
        };
        if (config.masterAccountRoleName !== undefined) {
            result.viaRole = AwsUtil.GetRoleArn(config.masterAccountId, config.masterAccountRoleName);
        }
        return result;
    }
};
