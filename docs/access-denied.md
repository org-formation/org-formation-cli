
## Troubleshooting access denied issues

This page is here to troubleshoot access denied issues you run into when using `org-formation`. typically this has to do with a misconfigured or missing `OrganizationAccountAccessRole`.

#### I just created the account using org-formation

Please rerun the process: as all things AWS are eventually consistent it could be that the `OrganizationAccountAccessRole` still needs to be created.

Do let me know in [the issues](https://github.com/OlafConijn/AwsOrganizationFormation/issues) if this problem doesnt resolve on its own or if you run into this a lot!

#### I have an account that joined my organization

It could be that the `OrganizationAccountAccessRole` is missing. please log into the account and create the Role manually. There is a CloudFormation template at the bottom of this page.


#### I created the account in the AWS Organizations console

It could be that you used a non-default name for the  `OrganizationAccountAccessRole`. Please log into the account and create the Role manually. There is a CloudFormation template at the bottom of this page.

If you feel it is important to support non-default role names for cross account access, let me know in [the issues](https://github.com/OlafConijn/AwsOrganizationFormation/issues).


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

[dowload](./organizationAccountAccessRole.yml)