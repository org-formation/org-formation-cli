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


export  const GetOrganizationAccessRoleInTargetAccount = async (config: ICrossAccountConfig, targetAccountId: string): Promise<ICrossAccountAccess> => {
    console.log(config);
    console.log(targetAccountId);
    if (config && config.masterAccountId === targetAccountId) {
        if (config.masterAccountRoleName !== undefined) {
            return {
                role: config.masterAccountRoleName,
            };
        }
        else {
            return {};
        }
    } else {
        const result: ICrossAccountAccess = {
            role: GlobalState.GetOrganizationAccessRoleName(targetAccountId),
        };
        if (config && config.masterAccountRoleName !== undefined && ! (await AwsUtil.GetBuildRunningOnMasterAccount())) {
            result.viaRole = AwsUtil.GetRoleArn(config.masterAccountId, config.masterAccountRoleName);
        }
        return result;
    }
};
