# AWS Organization Formation

Makes managing AWS Organizations easy!

Organization Formation allows you to manage AWS Organization resources and accounts using CloudFormation syntax

- [AWS Organization Formation](#aws-organization-formation)
  - [Installation](#installation)
  - [Getting started](#getting-started)
  - [Why managing your organization as code is important](#why-managing-your-organization-as-code-is-important)
  - [Example Template](#example-template)
  - [List of Resource Types](#list-of-resource-types)
    - [MasterAccount](#masteraccount)
    - [Account](#account)
    - [OrganizationRoot](#organizationroot)
    - [OrganizationalUnit](#organizationalunit)
    - [ServiceControlPolicy](#servicecontrolpolicy)
    - [PasswordPolicy](#passwordpolicy)
  - [Managing resources across accounts](#managing-resources-across-accounts)
    - [OrganizationBinding: Where to create which resource](#organizationbinding-where-to-create-which-resource)
    - [Creating cross account resource dependencies](#creating-cross-account-resource-dependencies)
    - [Referencing the account the resource is created in](#referencing-the-account-the-resource-is-created-in)
    - [Foreach: Iterating over accounts when creating resources](#foreach-iterating-over-accounts-when-creating-resources)
  - [Updating multiple templates at once](#updating-multiple-templates-at-once)

## Installation

```
> npm i aws-organization-formation
```

## Getting started

the following command will initialize organization formation and create an organization template.
```
> org-formation init organization.yml [--profile my-aws-profile]
```

after changing the organization template use:
```
> org-formation update organization.yml [--profile my-aws-profile]
```

or
```
> org-formation create-change-set organization.yml [--profile my-aws-profile]
```
and
```
> org-formation execute-change-set changeSetName [--profile my-aws-profile]
```

## Why managing your organization as code is important

Just like with resources within your AWS Account managing AWS Organization resources allows you to apply changes to these resources automatically, reducing manual work, inconsistencies and mistakes.

If you are considering to use an account vending machine (e.g. [AWS Control Tower](https://aws.amazon.com/controltower/)) to create and manage new accounts within your organization: Do realize that the account vending machine allows you to quickly create organization resources but only has limited facilities when it comes to updating and maintaining these resoruces.


## Example Template

```yml
AWSTemplateFormatVersion: '2010-09-09-OC'

Organization:
  Root:
    Type: OC::ORG::MasterAccount
    Properties:
      AccountName: My Organization Root
      AccountId: '123123123123'
      Tags:
        budget-alarm-threshold: '2500'
        account-owner-email: my@email.com

  OrganizationRoot:
    Type: OC::ORG::OrganizationRoot
    Properties:
      ServiceControlPolicies:
        - !Ref RestrictUnusedRegionsSCP

  ProductionAccount:
    Type: OC::ORG::Account
    Properties:
      RootEmail: production@myorg.com
      AccountName: Production Account
      Tags:
        budget-alarm-threshold: '2500'
        account-owner-email: my@email.com

  DevelopmentAccount:
    Type: OC::ORG::Account
    Properties:
      RootEmail: development@myorg.com
      AccountName: Development Account
      Tags:
        budget-alarm-threshold: '2500'
        account-owner-email: my@email.com

  DevelopmentOU:
    Type: OC::ORG::OrganizationalUnit
    Properties:
      OrganizationalUnitName: development
      Accounts:
        - !Ref DevelopmentAccount

  ProductionOU:
    Type: OC::ORG::OrganizationalUnit
    Properties:
      OrganizationalUnitName: production
      Accounts:
        - !Ref ProductionAccount

  RestrictUnusedRegionsSCP:
    Type: OC::ORG::ServiceControlPolicy
    Properties:
      PolicyName: RestrictUnusedRegions
      Description: Restrict Unused regions
      PolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Sid: DenyUnsupportedRegions
            Effect: Deny
            NotAction:
              - 'cloudfront:*'
              - 'iam:*'
              - 'route53:*'
              - 'support:*'
            Resource: '*'
            Condition:
              StringNotEquals:
                'aws:RequestedRegion':
                  - eu-west-1
                  - us-east-1
                  - eu-central-1
```

## List of Resource Types

Organization Formation supports the following AWS Organization resources:

### MasterAccount

MasterAccount is the AWS Account that functions as the master account within your organization.

**Type** OC::ORG::MasterAccount

**Properties**

|Property |Value|Remarks|
|:---|:---|:---|
|AccountName|Name of the master account |This property is required.<br/><br/>Changing the name of the AWS MasterAccount resource is not possible, this requires the root account to log in to the master account and change this manually.<br/><br/>However, it is possible to change the AccountName of the MasterAccount in the template and this change will be reflected when doing a !GetAtt on the resource from within a template.|
|AccountId|AccountId of the master account|This property is required.<br/><br/>Changing the AccountId of the master account is not supported.|
|RootEmail|RootEmail of the master account|This property is optional.<br/><br/>Changing the RootEmail of the MasterAccount AWS resource is not possible, this requires the root account to log in to the master account and change this manually. <br/><br/>However, it is possible to change the RootEmail of the MasterAccount in the template and this change will be reflected when doing a !GetAtt on the resource from within a template.|
|ServiceControlPolicies|Reference or list of References |This property is optional. <br/><br/>Reference or list of References to [ServiceControlPolicy](#servicecontrolpolicy) resources that must be enforced on the MasterAccount|
|PasswordPolicy|Reference|This property is optional.<br/><br/>Reference to the [PasswordPolicy](#passwordpolicy) resource that must be  enforced on the MasterAccount.|
|Alias|IAM alias|This property is optional.<br/><br/>The [IAM Alias](https://docs.aws.amazon.com/IAM/latest/UserGuide/console_account-alias.html) associated with the account. Organization Formation supports a maximum of 1 IAM alias per account|
|Tags|Dictionary|This property is optional.<br/><br/>Dictionary that contains the tags on the MasterAccount resource|

**Example**

```yaml
    Type: OC::ORG::MasterAccount
    Properties:
      Alias: org-formation-master
      AccountName: My Organization Formation Master Account
      AccountId: '123456789012'
      ServiceControlPolicies: !Ref ServiceControlPolicy
      PasswordPolicy: !Ref PasswordPolicy
      Tags:
        tag1: Value of Tag
        tag2: Value of Tag 2
```

**!Ref** Returns the AccountId of the MasterAccount resource.

**!GetAtt** *&lt;logicalId&gt;*.AccountName returns the AccountName of the MasterAccount resource.

**!GetAtt** *&lt;logicalId&gt;*.Alias returns the IAM alias of the MasterAccount resource.

**!GetAtt** *&lt;logicalId&gt;*.AccountId returns the AccountId of the MasterAccount resource.

**!GetAtt** *&lt;logicalId&gt;*.RootEmail returns the RootEmail of the MasterAccount resource.

**!GetAtt** *&lt;logicalId&gt;*.Tags.*&lt;Key&gt;* returns the value of tag *&lt;Key&gt;* for the MasterAccount resource.

### Account

Account is an AWS Account within your organization.

**Type** OC::ORG::Account

**Properties**

|Property |Value|Remarks|
|:---|:---|:---|
|AccountName|Name of the account |This property is required.<br/><br/>Changing the name of the AWS Account resource is not possible, this requires the root account to log in to the account and change this manually. <br/><br/>However, it is possible to change the AccountName of the Account in the template and this change will be reflected when doing a !GetAtt on the resource from within a template.|
|AccountId|AccountId of account|This property is optional.<br/><br/>Changing the AccountId of the account is not supported|
|RootEmail|RootEmail of the account|This property is optional (only if AccountId is specified)<br/><br/>Changing the RootEmail of the Account AWS resource is not possible, this requires the root account to log in to the master account and change this manually. <br/><br/>However, it is possible to change the RootEmail of the MasterAccount in the template and this change will be reflected when doing a !GetAtt on the resource from within a template.|
|ServiceControlPolicies|Reference or list of References |This property is optional. <br/><br/>Reference or list of References to [ServiceControlPolicy](#servicecontrolpolicy) resources that must be enforced on the Account.|
|PasswordPolicy|Reference|This property is optional.<br/><br/>Reference to the [PasswordPolicy](#passwordpolicy) resource that must be  enforced on the Account.|
|Alias|IAM alias|This property is optional.<br/><br/>The [IAM Alias](https://docs.aws.amazon.com/IAM/latest/UserGuide/console_account-alias.html) associated with the account. Organization Formation supports a maximum of 1 IAM alias per account|
|Tags|Dictionary|This property is optional.<br/><br/>Dictionary that contains the tags on the Account resource|

**Note** When creating an account the RootEmail and AccountName are used to create the Account resource in AWS. The AccountId property can later be added as a means of ‘documentation’ but this is not required.

**!Ref** Returns the AccountId of the Account resource.

**!GetAtt** *&lt;logicalId&gt;*.AccountName returns the AccountName of the Account resource.

**!GetAtt** *&lt;logicalId&gt;*.Alias returns the IAM alias of the Account resource.

**!GetAtt** *&lt;logicalId&gt;*.AccountId returns the AccountId of the Account resource.

**!GetAtt** *&lt;logicalId&gt;*.RootEmail returns the RootEmail of the Account resource.

**!GetAtt** *&lt;logicalId&gt;*.Tags.*&lt;Key&gt;* returns the value of tag *&lt;Key&gt;* for the Account resource.

**Example**

```yaml
  MyAccount1:
    Type: OC::ORG::Account
    Properties:
      RootEmail: my-aws-account-1@org-formation.com
      Alias: org-formation-account-1
      AccountName: Org Formation Sample Account 1
      AccountId: '123456789012'
      ServiceControlPolicies: !Ref ServiceControlPolicy
      PasswordPolicy: !Ref PasswordPolicy
      Tags:
        tag1: Value of Tag
        tag2: Value of Tag 2
```


### OrganizationRoot

OrganizationRoot is the AWS Root Resource that functions like a top-level Organizational Unit within your Organization.

**Type** OC::ORG::OrganizationRoot

**Properties**

|Property |Value|Remarks|
|:---|:---|:---|
|ServiceControlPolicies|Reference or list of References |This property is optional. <br/><br/>Reference or list of References to [ServiceControlPolicy](#servicecontrolpolicy) resources that must be enforced on all accounts (including master account) within the AWS Organization.|

**Note** Any account (or master account) within an AWS organization that is not part of an Organizational Unit will be a member of the Organizational Root.

**!Ref** Returns the physical id of the OrganizationRoot resource.

**Example**

```yaml
  OrganizationRoot:
    Type: OC::ORG::OrganizationRoot
    Properties:
      ServiceControlPolicies:
        - !Ref DenyChangeOfOrgRoleSCP
        - !Ref RestrictUnusedRegionsSCP
```


### OrganizationalUnit

OrganizationalUnit is an AWS Organizational Unit within your organization and can be used to group accounts and apply policies to the accounts within the organizational unit.

**Type** OC::ORG::OrganizationalUnit

**Properties**

|Property |Value|Remarks|
|:---|:---|:---|
|OrganizationalUnitName|Name of the organizational unit|This property is required.
|Accounts|Reference or list of References|This property is optional.<br/><br/>Reference or list of References to [Account](#account) resources that need to be part of the Organizational Unit.
|ServiceControlPolicies|Reference or list of References |This property is optional. <br/><br/>Reference or list of References to [ServiceControlPolicy](#servicecontrolpolicy) resources that must be enforced on all accounts (including master account) within the AWS Organization.|

**Note** It is currently not supported to nest organizational units (have an OU as the parent of another OU). It is also not possible to add a MasterAccount resource to an OU.

**!Ref** Returns the physical id of the OrganizationalUnit resource.

**Example**

```yaml
  DevelopmentOU:
    Type: OC::ORG::OrganizationalUnit
    Properties:
      OrganizationalUnitName: development
      ServiceControlPolicies:
        - !Ref DenyChangeOfOrgRoleSCP
      Accounts:
        - !Ref DevelopmentAccount1
        - !Ref DevelopmentAccount2
```


### ServiceControlPolicy

ServiceControlPolicy is an [AWS Service Control Policy](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scp.html) that can be used to manage permissions within the accounts contained in your organization.

**Type** OC::ORG::ServiceControlPolicy

**Properties**

|Property |Value|Remarks|
|:---|:---|:---|
|PolicyName|Name of the SCP|This property is required.
|Description|Description of the SCP|This property is optional.
|PolicyDocument|Policy Document|This property is optional.

**!Ref** Returns the physical id of the ServiceControlPolicy resource.

**Example**

```yaml
  RestrictUnusedRegionsSCP:
    Type: OC::ORG::ServiceControlPolicy
    Properties:
      PolicyName: RestrictUnusedRegions
      Description: Restrict Unused regions
      PolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Sid: DenyUnsupportedRegions
            Effect: Deny
            NotAction:
              - 'cloudfront:*'
              - 'iam:*'
              - 'route53:*'
              - 'support:*'
            Resource: '*'
            Condition:
              StringNotEquals:
                'aws:RequestedRegion':
                  - eu-west-1
                  - us-east-1
                  - eu-central-1
```


### PasswordPolicy

PasswordPolicy is an [AWS IAM Password Policy](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_passwords_account-policy.html) that applies to all IAM Users within the account.

**Type** OC::ORG::PasswordPolicy

**Properties**

|Property |Value|Remarks|
|:---|:---|:---|
|MaxPasswordAge|number|This property is optional.
|MinimumPasswordLength|number|This property is optional.
|RequireLowercaseCharacters|boolean|This property is optional.
|RequireNumbers|boolean|This property is optional.
|RequireSymbols|boolean|This property is optional.
|RequireUppercaseCharacters|boolean|This property is optional.
|PasswordReusePrevention|number|This property is optional.
|AllowUsersToChangePassword|boolean|This property is optional.

**Example**

```yaml
  PasswordPolicy:
    Type: OC::ORG::PasswordPolicy
    Properties:
      MaxPasswordAge: 30
      MinimumPasswordLength: 12
      RequireLowercaseCharacters: true
      RequireNumbers: true
      RequireSymbols: true
      RequireUppercaseCharacters: true
      PasswordReusePrevention: 5
      AllowUsersToChangePassword: true
```

## Managing resources across accounts

[CloudFormation](https://aws.amazon.com/cloudformation/) is the infrastructure as code solution native to AWS. It works great when managing resources within a single organization but doesnt contain syntax to manage resources across multiple accounts.

examples:
- In CloudFormation it is not possible to specify a !Ref to another resource in another account or region.
- In CloudFormation it is not possible to reference organization resource attributes
- In CloudFormation it is possible to deploy stacks to multiple accounts (using [StackSets](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/what-is-cfnstacksets.html)) but only a subset of Cloudformation features can be used.

The constraints above can be difficult when managing a baseline of resources across different accounts in an AWS Organization:
- Relationships between resources in different accounts/regions are important.
- Variability in resource configuration needs to be managed centranlly and relative to the account resource

Organization Formation allows you to define any CloudFormation resource and annotate this with additional attributes that contain information about how these should be bound to the accounts within your organization.

**example**:
In this example a IAM Group will be created in the SharedUsersAccount and a IAM Role will be created in all accounts. The IAM Role however can only be assume from the SharedUserAccount and the Group can only assume this specific Role.

```yaml
AWSTemplateFormatVersion: 2010-09-09-OC

# include organization template.
Organization: !Include ./organization.yml

# default region (can be list)
OrganizationBindingRegion: eu-central-1

Resources:

  # this resource will only be created in the SharedUsersAccount
  DeveloperGroup:
    OrganizationBinding:
      Account: !Ref SharedUsersAccount
    Type: AWS::IAM::Group
    Properties:
      GroupName: DevelopersGroup
      Policies:
        - PolicyName: assume-roles
          PolicyDocument:
            Version: 2012-10-17
            Statement:
              - Effect: Allow
                Action: sts:AssumeRole
                Resource: arn:aws:iam::*:role/DeveloperRole

  # this resource will only be created in all accounts (except the organizational master)
  DeveloperRole:
    OrganizationBinding:
      Account: '*'
    Type: AWS::IAM::Role
    Properties:
      ManagedPolicyArns:
      - arn:aws:iam::aws:policy/PowerUserAccess
      RoleName: DeveloperRole
      AssumeRolePolicyDocument:
       Version: 2012-10-17
       Statement:
         - Effect: Allow
           Action: sts:AssumeRole
           Principal:
            AWS: !Ref SharedUsersAccount # role can only be assumed from SharedUsersAccount
```

### OrganizationBinding: Where to create which resource
In Orgnization Formation every resource can have an ```OrganizationBinding``` attribute. This attribute specifies in which accounts the resource must be created. The ```OrganizationBinding``` atribute looks like:

```yaml
Resources:
  Bucket:
    OrganizationBinding:
      Region: eu-west-1
      Account:
       - !Ref Account1
       - !Ref Account2
    Type: AWS::S3::Bucket
```

In the example above the resource Bucket will be created for Account1 and Account2 in the eu-west-1 region.

There is a lot of other ways to specify an account binding though:


|Attribue |Value|Remarks|
|:---|:---|:---|
|Region|String or list of String|Resource will be created in all the specified resources.|
|Account|literal '*'|Resource will be created in all accounts **except** for the master account.|
||!Ref or list of !Ref|Resource will be created in [Accounts](#account) that are referred to.|
|OrganizationalUnit|!Ref or list of !Ref|Resource will be created in all accounts that below to the [OrganizationalUnits](#organizationalunit) that are refered to.|
|ExcludeAccount|!Ref or list of !Ref|Resource will **not** be created in [Accounts](#account) that are referred to.|
|IncludeMasterAccount|```true``` or ```false```| If ```true```, resource will be created in the organizational master account.|
|AccountsWithTag|tag-name|Resource will be created in all accounts that have a tag specified with tag-name.|

Attributes can be combined and are **additive** (except for ```ExcludeAccount```).





### Creating cross account resource dependencies

If you have a resource that you need to refer to from within another resource (using ```!Ref``` or ```!GetAtt```) Organization Formation helps you to do this across AWS accounts.

As every resource has its own ```OrganizationBinding``` and therefore will need to be added to a different set of accounts Organization Formation creates a template specific to every target account refered to from within the template.

If, within a template, you use ```!Ref``` ir ```!GetAtt``` to refer to another resource in another account Organization Formation will create an export in the template that exposes the resource and create a parameter in the template that uses the value. It will work exactly how you would expect it to in cloudformation.

**example**:

```yaml
AWSTemplateFormatVersion: '2010-09-09-OC'

Organization: !Include ./organization.yml
OrganizationBindingRegion: eu-central-1

Resources:

  CloudTrailS3Bucket:
    OrganizationBinding:
      Account: !Ref ComplianceAccount
    DeletionPolicy: Retain
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub 'cloudtrail-${ComplianceAccount}'

  # omitted some resources like bucket policy

  CloudTrail:
    OrganizationBinding:
      Account: '*'
      IncludeMasterAccount: true
    Type: AWS::CloudTrail::Trail
    Properties:
      # this will, in any account, resolve to the name of CloudTrailS3Bucket in the ComplianceAccount.
      S3BucketName: !Ref CloudTrailS3Bucket
      IsLogging: false

```

**note**: The above will only work if resource ```CloudTrailS3Bucket``` only is bound to 1 account and region. If a resource is deployed to multiple accounts, you can alternatively use the syntax ```!Ref ComplianceAccount.Resources.CloudTrailS3Bucket``` or ```!GetAtt ComplianceAccount.Resources.CloudTrailS3Bucket.Arn```.


### Referencing the account the resource is created in

In CloudFormation it is possible to reference the accountId of the account the resource is created in using ```AWS::AccountId``` and the region using ```AWS::Region```. As Organization Formation template are regular cloudformation this remains possible.

Organization Formation adds a way to reference the account resource of the account for which the resource is created using  **AWSAccount**

**example**
```yaml
  Budget:
    Type: AWS::Budgets::Budget
    OrganizationBinding:
      Account: '*'
    Properties:
      Budget:
        BudgetName: !Sub '${resourcePrefix}-budget-${AWSAccount.Alias}'
        BudgetLimit:
          Amount: !GetAtt AWSAccount.Tags.budget-alarm-threshold
          Unit: USD
        TimeUnit: MONTHLY
        BudgetType: COST
```


### Foreach: Iterating over accounts when creating resources

If, in Organization Formation, you need to create a resource ```for each``` account in a specific selection you can do so with a Foreach attribute.

**example**
```yaml
  Member:
    Type: AWS::GuardDuty::Member
    OrganizationBinding:
      IncludeMasterAccount: true
    Foreach:
      Account: '*'
    Properties:
      DetectorId: !Ref Detector
      Email: !GetAtt CurrentAccount.RootEmail
      MemberId: !Ref CurrentAccount
      Status: Invited
      DisableEmailNotification: true
```

In the example above a ```Member``` resource will be created in the ```Master``` for each account in the selector ```Account: '*'```. The [account](#account) that is iterated over can be accessed using ```CurrentAccount```.

The ``Foreach`` attribute is has the same expressiveness as the [OrganizationBinding](#organizationbinding-where-to-create-which-resource) but does not support ``Region``.

Please consider the following template for some more context. It sets up [GuardDuty](https://aws.amazon.com/guardduty/) for a complete organization using 3 resources!

```yaml
AWSTemplateFormatVersion: '2010-09-09-OC'

Organization: !Include ./organization.yml
OrganizationBindingRegion: eu-central-1

Resources:
  Detector:
    Type: AWS::GuardDuty::Detector
    OrganizationBinding:
      Account: '*'
      IncludeMasterAccount: true
    Properties:
      Enable: 'true'
  Master:
    DependsOnAccount: !Ref MasterAccount
    Type: AWS::GuardDuty::Master
    OrganizationBinding:
      Account: '*'
    Properties:
      DetectorId: !Ref Detector
      MasterId: !Ref MasterAccount
  Member:
    Type: AWS::GuardDuty::Member
    OrganizationBinding:
      IncludeMasterAccount: true
    Foreach:
      Account: '*'
    Properties:
      DetectorId: !Ref Detector
      Email: !GetAtt CurrentAccount.RootEmail
      MemberId: !Ref CurrentAccount
      Status: Invited
      DisableEmailNotification: true
```

The template above specifies that:
- Every account, including the master account, gets a ``Detector`` resource.
- Ever account, except for the master account, gets a ``Master`` resource.
- The ``MasterAccount`` gets a Member resource for each account that is refered to from the ``Master`` resource in that account.

yes, the creation of ``Master`` resources to 'Members' and ``Member`` ressources to the Master account is confusing. This, unfortunately, is how Guardduty works in CloudFormation.


## Updating multiple templates at once

You might well have multiple templates you would like to provision within your organization and manage centrally. Additionally might want to have a code repository set up with these templates and run them using a CI/CD solution.

A solution to update multiple Organization Formation templates at once is task files:

**example:**

```yaml

OrganizationUpdate:
  Type: update-organization
  Template: ./organization.yml

Roles:
  Type: update-stacks
  Template: ./roles.yml
  StackName: roles

BudgetAlarms:
  Type: update-stacks
  Template: ./budget-alarms.yml
  StackName: budget-alarms

```
The tasks listed in the file above can be executed using:

```> org-formation perform-tasks taskfile.yml  [--profile my-aws-profile]```

## List of Task Types

### update-organization

The ``update-organization`` task will update all the organization resources based on the template specified as ``Template``.

|Attribute |Value|Remarks|
|:---|:---|:---|
|Template|relative path|This property is required.|

### update-stacks

The ``update-stacks`` task will provision all resources in all accounts specified in  ``Template``.

|Attribute |Value|Remarks|
|:---|:---|:---|
|Template|relative path|This property is required. <br/><br/>Specifies the Organization Formation template of which the resources must be updated]
|DependsOn|Name of task or list of names|The tasks listed in this attribute will be executed before this task.|
|StackName|string|This property is required.<br/><br/>Specifies the name of the stack that will be created in all accounts/regions.|
|StackDescription|string|If specified value will be set as the description of the created stacks<br/><br/> note: this value can be overridden by a Description attribute within the stack|
|Parameters|Dictionary|Specifies parameters that must be used when executing the stacks.|
|TerminationProtection|true or false|If true termination protection will be enabled on all stacks created for this template|
|OrganizationBindingRegion|String or list of String|Default region or regions used when executing templates.<br/><br/> note: this value can be overridden within the template or resources|
|OrganizationBinding|[OrganizationBinding](#organizationbinding-where-to-create-which-resource)| organization binding used when executing templates.<br/><br/> note: this value can be overridden within the template or resources|
|OrganizationFile|relative path|organization file used when executing templates.<br/><br/> note: when specified the template being executed could be a Cloudformation compatible template (without any organization formation specific attributes).|

**example**
```yaml
BudgetAlarms:
  Type: update-stacks
  Template: ./budget-alarms.yml
  StackName: budget-alarms
  TerminationProtection: true
  OrganizationBinding:
    AccountsWithTag: budget-alarm-threshold
  OrganizationBindingRegion: eu-central-1
  Parameters:
    resourcePrefix: my
```

```yaml
CloudformationSetup:
  Type: update-stacks
  Template: ./cloudformation-setup.yml
  StackName: cloudformation-setup
  StackDescription: 'Cloudformation setup used by stacksets'
  OrganizationFile: ./organization.yml
  TerminationProtection: true
  OrganizationBindingRegion: eu-central-1
  OrganizationBinding:
    Account: '*'
```

### include

The ``include`` include another taskfile with tasks to be executed.

|Attribute |Value|Remarks|
|:---|:---|:---|
|DependsOn|Name of task or list of names|The tasks listed in this attribute will be executed before this task.|
|Path|relative path|This property is required.<br/><br/> Specifies the Path of the taskfile that should be included.|
|MaxConcurrentTasks|number|The number of tasks within the imported file that should be executed concurrently.|
|FailedTaskTolerance|number|The number of failed tasks within the imported file that will cause the tasks to fail.|

**example**
```yaml
Include:
  Type: include
  DependsOn: otherTask
  Path: ./build-tasks-include.yml
  MaxConcurrentTasks: 10
  FailedTaskTolerance: 10
```

