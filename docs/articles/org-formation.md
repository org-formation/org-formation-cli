# Managing your AWS Organization using org-formation.

For those unfamiliar with AWS Organizations: AWS Organizations is an AWS service that can be used to create new AWS Accounts and associate these with the account you use the service from.

Having multiple AWS Accounts and using AWS Organizations to manage these accounts has a number of benefits including:
- Reducing the impact of mistakes (or security incidents) in any of your accounts.
- Scalability in terms of resource limits over different accounts.
- Simplify adhering to security principles like 'least privilege' across different systems

For more information and considerations on how to set up your AWS Organization you can also refer to this article: [Off to a great start with AWS Organizations](https://dev.to/oconijn/off-to-a-great-start-with-aws-organizations-1i74).

## AWS Organization Formation

AWS Organization Formation (`org-formation` for short) is a community supported tool that allows you to manage different aspects of your AWS Organization through Infrastructure as Code (IaC). Managing your AWS Organization as code allows you to store the definition of your AWS Organization in a sourcecode repository and deploy changes in an automated way decreasing the likelihood of human errors and greatly improving the auditability of your AWS Organization.

AWS Organization Formation supports 3 main usecases:
1. Managing the AWS Organization resources as code, e.g. creating a new AWS Account, Organizational Unit or Service Control Policy.
2. Annotating CloudFormation templates with Organization Bindings that describe *what* CloudFormation resources need to be deployed *where* and the relations between these resources.
3. Continuos deployment of changes to the AWS Organization resources, annotated CloudFormation templates and other resource types like CDK Workloads or Serverless.com projects.

In order to start using the org-formation you'll first need to install it. This can be done using npm:
``` bash
> npm i aws-organization-formation -g
```

TODO: how does the tool work

## Creating your organization.yml file

In order to start using org-formation you will need to create an organization.yml file. The organization.yml file will contain the code that describes your AWS Organization service resources. Org-formation allows you to generate the organization.yml using the `init` command.

The `init` command can be ran regardless of what tool you have used to create the AWS Organization. It can also be ran at a later point in time to recreate a new organization.yml file if needed.

The following command will generate an organization.yml file for your organization:

``` bash
\> org-formation init organization.yml --region eu-central-1 --profile aws-profile
```

**note that**

1. The `--region` option is required as the init command will create an S3 bucket and the --region option is used to specify the region the bucket must be created in.
2. The `--profile` option is optional and can be used to reference an AWS profile configured in the aws cli. The AWS credentials used (either the default credential or those associated with the profile specified) must give access to the AWS Account that contains the AWS Organization resources (the 'Master Account') and have sufficient right to interact with the AWS Organization service and assume the accounts contained within the AWS Organization.
3. There is the option of specifying a specific S3 Bucket Name `--state-bucket-name` and object name for the file org-formation uses to keep track of state `--state-object`.

If all went well you now have a file that is called organization.yml in your current directory that  will contain a top-level `Organization` attribute that contains the different resources contained within your AWS Organization.

For Example:

``` yaml
  MasterAccount:
    Type: OC::ORG::MasterAccount
    Properties:
      AccountName: My Organization Master Account
      AccountId: '111222333444'

  OrganizationRoot:
    Type: OC::ORG::OrganizationRoot

  ProductionOU:
    Type: OC::ORG::OrganizationalUnit
    Properties:
      OrganizationalUnitName: production
      Accounts: !Ref ProductionAccount

  DevelopmentOU:
    Type: OC::ORG::OrganizationalUnit
    Properties:
      OrganizationalUnitName: development
      Accounts:
        - !Ref DevelopmentAccount

  ProductionAccount:
    Type: OC::ORG::Account
    Properties:
      AccountName: Production Account
      AccountId: '111111111111'
      RootEmail: aws-accounts+production@myorg.com

  DevelopmentAccount:
    Type: OC::ORG::Account
    Properties:
      AccountName: Development Account
      AccountId: '222222222222'
      RootEmail: aws-accounts+dev@myorg.com
```

In the example above you will see the following resources:
- MasterAccount: This resource is of type `OC::ORG::MasterAccount` and refers to the AWS Account that contains the AWS Organization resources. It must be part of your template and it must have an AccountId, apart from this it has all the same attributes as any other account in the organization.yml file. the AccountId from this resource will be compared with the MasterAccountId in the state file and the AWS Identity used to update the organization in order to prevent mistakes updating the wrong AWS Account.
- OrganizationRoot: This resource, of type `OC::ORG::OrganizationRoot`, is the root object for the hierarchical organization structure that contains accounts and organizational units. This resource can be used to attach Service Control Policies to all of the accounts within the organization.
- ProductionOU and DevelopmentOU: These resources, of type `OC::ORG::OrganizationRoot`, are 2 Organizational Units directly underneath the OrganizationRoot. These Organizational Units can be used to contains AWS Accounts and other Organizational Units and/or apply Service Control policies to accounts within the Organizational Unit.
- ProductionAccount and DevelopmentAccount: These resources, of type `OC::ORG::Account`, are 2 AWS accounts contained in respectively the ProductionOU and DevelopmentOU Organizational Units.

Any of these resources might have been created by org-formation previously or by another tool. Frankly this doesn't matter much as from now on we can use the organization.yml file to manage (Create/Update/Delete) these resources by changing them in the organization.yml file and executing the `org-formation update` command.

Note that: In AWS Accounts cannot be deleted.