
## Troubleshooting access denied issues

This page is here to troubleshoot access denied issues you run into when using `org-formation`. Typically this has to do with a misconfigured or missing cross-account role - by default this is `OrganizationAccountAccessRole`. org-formation also supports non-default role names by using `--cross-account-role-name` as a [command line option](https://github.com/org-formation/org-formation-cli/blob/master/docs/cli-reference.md#org-formation-init) during init or by setting the `DefaultOrganizationAccessRoleName` attribute on your `OC::ORG::OrganizationRoot`. This value can also be overwritten for every account using the `OrganizationAccessRoleName` on your `OC::ORG::Account`s. For further information see the [organization resources page](https://github.com/org-formation/org-formation-cli/blob/master/docs/organization-resources.md).


#### I am logged in as the root user

root users cannot assume IAM Roles and therefore cannot be used. Also: it is not recommended to use the root user (see also: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_root-user.html)

#### I just created the account using org-formation

Please rerun the process: as all things AWS are eventually consistent it could be that the cross-account role (default `OrganizationAccountAccessRole`) still needs to be created.

Do let me know in [the issues](https://github.com/OlafConijn/AwsOrganizationFormation/issues) if this problem doesn't resolve on its own or if you run into this a lot!


#### I have an account that joined my organization

It could be that the cross-account role (default `OrganizationAccountAccessRole`) is missing. please log into the account and create the Role manually. There is a CloudFormation template at the bottom of this page.


#### I created the account in the AWS Organizations console

Please check the cross-account role is present in the console created account. By default this is `OrganizationAccountAccessRole` but also check your organization configuration to see if a non-default value is being used. If the role is missing, please log into the account and create the Role manually. There is a CloudFormation template at the bottom of this page. You may need to adjust the role name.


#### CloudFormation template to create the OrganizationAccountAccessRole

**Note**: if you copied the `DenyChangeOfOrgRoleSCP` Policy from the [example organization](../examples/organization.yml) to your organization, make sure you temporarily detach it. Otherwise CloudFormation will fail with an `explicit deny`.

If you did not copy the `DenyChangeOfOrgRoleSCP` Policy into your organization, you might want to consider this. It explicitly denies anyone to change the Role below.

``` yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Creates the OrganizationAccountAccessRole for cross account access'

Parameters:

  masterAccountId:
    Type: String

Resources:
  Role:
    Type: AWS::IAM::Role
    Properties:
      ManagedPolicyArns:
      - arn:aws:iam::aws:policy/AdministratorAccess
      RoleName: OrganizationAccountAccessRole
      AssumeRolePolicyDocument:
       Version: 2012-10-17
       Statement:
         - Effect: Allow
           Action: sts:AssumeRole
           Principal:
            AWS: !Ref masterAccountId
```

[download](./organizationAccountAccessRole.yml)
