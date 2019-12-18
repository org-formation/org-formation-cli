# AWS Organization Formation

Makes managing AWS Organizations easy!

Organization Formation allows you to manage AWS Organization resources and accounts using CloudFormation syntax

- [AWS Organization Formation](#aws-organization-formation)
  - [Installation](#installation)
  - [Getting started](#getting-started)
  - [Why managing your organization as code is important](#why-managing-your-organization-as-code-is-important)
  - [Example Template](#example-template)
  - [List of Task Types](#list-of-task-types)
    - [update-organization](#update-organization)
    - [update-stacks](#update-stacks)
    - [include](#include)

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

```yaml
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

