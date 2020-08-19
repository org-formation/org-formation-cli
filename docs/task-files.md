
<!-- @import "[TOC]" {cmd="toc" depthFrom=2 depthTo=6 orderedList=false} -->

<!-- code_chunk_output -->

- [Parameters](#parameters)
- [Functions](#functions)
  - [!CopyValue](#copyvalue)
- [Task types](#task-types)
  - [update-organization](#update-organization)
  - [update-stacks](#update-stacks)
  - [update-serverless.com](#update-serverlesscom)
  - [copy-to-s3](#copy-to-s3)
  - [update-cdk](#update-cdk)
  - [include](#include)

<!-- /code_chunk_output -->


# Automating deployments

You might well have multiple templates you would like to provision within your organization and manage centrally. Additionally might want to have a code repository set up with these templates and run them using a CI/CD solution.

A solution to update multiple Organization Formation templates at once is task files:

**example:**

```yaml

Parameters:
  resourcePrefix:
    Type: String
    Default: my

OrganizationUpdate:
  Type: update-organization
  Template: ./organization.yml

Roles:
  Type: update-stacks
  Template: ./roles.yml
  StackName: roles
  Parameters:
    ResourcePrefix: !Ref resourcePrefix

BudgetAlarms:
  Type: update-stacks
  Template: ./budget-alarms.yml
  StackName: budget-alarms
  Parameters:
    ResourcePrefix: !Ref resourcePrefix

```
The tasks listed in the file above can be executed using:

``> org-formation perform-tasks taskfile.yml  [--profile my-aws-profile]``

For more info see the [cli reference](cli-reference.md)

## Parameters

Parameters can be declared in a top-level Parameters attribute and referred to throughout the taskfile using `!Ref` or from within a `!Sub` construct.

example:
``` yaml

Parameters:

  stackPrefix:
    Description:
    Type: String

  includeMasterAccount:
    Description:
    Type: Boolean
    Default: true

BucketTemplate:
  Type: update-stacks
  Template: ./bucket.yml
  StackName: !Sub ${stackPrefix}-scenario-stack-parameters
  DefaultOrganizationBindingRegion: eu-west-1
  DefaultOrganizationBinding:
    IncludeMasterAccount: !Ref includeMasterAccount
```

Parameter values can be specified as default value or passed to th `perform-tasks` command over the command line using the following syntax:

``` bash
\> org-formation perform-tasks taskfile.yml --parameters Param1=Val1 Param2=Val2
```

## Functions

The following functions can be used within a taskfile:

### !CopyValue

The `!CopyValue` will take up to 3 arguments *exportName*, *accountId* and *region* and it will return the value of the export (from the specified *accountId* and *region*). Unlike `!ImportValue` it will continue to allow you to delete the stack that declares the export.

If *accountId* and/or *region*) are not specified the account and region of the target are used. If you have an Organization Binding with 6 targets and do not specify *accountId* or *region* the export is expected to be found in all 6 targets (Account/Region combinations).

The following example shows various ways to use the !CopyValue function:

``` yaml
PolicyTemplate:
  DependsOn: BucketTemplate
  Type: update-stacks
  Template: ./bucket-policy.yml
  StackName: scenario-export-bucket-role
  DefaultOrganizationBindingRegion: eu-west-1
  DefaultOrganizationBinding:
    IncludeMasterAccount: true
  Parameters:
    bucketArn: !CopyValue BucketArn
    bucketArn2: !CopyValue [BucketArn, !Ref MasterAccount]
    bucketArn4: !CopyValue [BucketArn, !Ref MasterAccount, 'eu-west-1']
    bucketArn3: !CopyValue [BucketArn, 123123123123, 'eu-west-1']
```

## Task types

### update-organization

The ``update-organization`` task will update all the organization resources based on the template specified as ``Template``.

|Attribute |Value|Remarks|
|:---|:---|:---|
|Template|relative path|This property is required.|
|Skip| `true` or `false`| When `true` task (and dependent tasks) will not be executed.|

### update-stacks

The `update-stacks` task will provision all resources in all accounts specified in  `Template`.

|Attribute |Value|Remarks|
|:---|:---|:---|
|Template|relative path|This property is required. <br/><br/>Specifies the Organization Formation template of which the resources must be updated
|DependsOn|Name of task or list of names|The tasks listed in this attribute will be executed before this task.|
|Skip| `true` or `false` |When `true` task (and dependent tasks) will not be executed.|
|StackName|string|This property is required.<br/><br/>Specifies the name of the stack that will be created in all accounts/regions.|
|StackDescription|string|If specified, value will be set as the description of the created stacks<br/><br/> **note**:  This value overrides values within the template or resources (value in taskfile is leading). |
|Parameters|Dictionary|Specifies parameters that must be used when executing the template.|
|OrganizationFile|relative path|Organization file used when executing templates.<br/><br/>**note**: This value overrides values within the template or resources (value in taskfile is leading).<br/><br/> **note**: This value can also be used if template is plain CloudFormation.|
|TerminationProtection|true or false|When set to `true` termination protection will be enabled on all stacks created for this template.|
|UpdateProtection|true or false|When set to `true` will create a StackPolicy for the stacks that prevents any resource from being modified through CloudFormation.|
|StackPolicy|stack policy|When specified will apply stack policy to all stacks created.|
|DefaultOrganizationBindingRegion|String or list of String|Region or regions that will be used for any binding without Region specified.<br/><br/> **note**:  This value overrides values within the template or resources (value in taskfile is leading).<br/><br/> **note**: This value can also be used if template is plain CloudFormation.|
|DefaultOrganizationBinding|[OrganizationBinding](#organizationbinding-where-to-create-which-resource)| Organization binding used for any resource that has no binding specified.<br/><br/> **note**:  This value overrides values within the template or resources (value in taskfile is leading). <br/><br/> **note**: This value can also be used if template is plain CloudFormation.|
|OrganizationBindings|Dictionary of String, [OrganizationBinding](#organizationbinding-where-to-create-which-resource)| Set of named OrganizationBindings that can be `!Ref`'d by Resources.<br/><br/> **note**: This value overrides values within the template or resources (value in taskfile is leading).|
|CloudFormationRoleName|string|Specifies the name of the IAM Role that must be used to pass to the CloudFormation service. A role with this is expected to exist in the target account (and have the right AssumeRole permissions).|
|TaskRoleName|string|Specifies the name of the IAM Role that must be used for cross account access. A role with this is expected to exist in the target account (and have the right AssumeRole permissions).|


**example**
```yaml
BudgetAlarms:
  Type: update-stacks
  Template: ./budget-alarms.yml
  StackName: budget-alarms
  TerminationProtection: true
  UpdateProtection: false
  DefaultOrganizationBindingRegion: eu-central-1
  OrganizationBindings:
    BudgetAlarmBinding:
      AccountsWithTag: budget-alarm-threshold
  Parameters:
    resourcePrefix: my
```

```yaml
Roles:
  Type: update-stacks
  Template: ./cross-account-role.yml
  StackName: developer-role
  StackDescription: 'Developer Role'
  TerminationProtection: false
  UpdateProtection: true
  Parameters:
    roleName: DeveloperRole
    rolePolicyArns:
      - arn:aws:iam::aws:policy/PowerUserAccess
  OrganizationBindings:
    RoleAccountBinding:
      OrganizationalUnit: !Ref DevelopmentOU
    AssumeRoleBinding:
      Account: !Ref SharedUsersAccount
```

### update-serverless.com

The ``update-serverless.com`` task will deploy the [serverless.com](https://serverless.com) workload defined in the directory specified by `Path`.

|Attribute |Value|Remarks|
|:---|:---|:---|
|Path|relative path|This property is required. <br/><br/>Specifies which directory contains the serverless.com workload
|OrganizationBinding| [OrganizationBinding](#organizationbinding-where-to-create-which-resource)|This property is required. <br/><br/>Organization binding used to specify which accounts the serverless.com workload needs to be deployed to.|
|Config| relative path |Name of the Serverless.com configuration file that contains information about the payload.<br/><br/>default is **./serverless.yml**|
|Stage|string|Value used as stage when deploying the serverless.com workload|
|RunNpmInstall|boolean| When true, `npm ci` will be ran before serverless deployment and removal|
|CustomDeployCommand| string | When specified will override the default command used when deploying a serverless.com workload. <br/><br/>default command is: `npm ci && npx sls deploy ${CurrentTask.Parameters} --region ${region} --stage ${stage} --config ${config}  --conceal`. |
|CustomRemoveCommand| string | When specified will override the default command used when removing a serverless.com workload. <br/><br/>default command is: `npm ci && npx sls remove ${CurrentTask.Parameters} --region ${region} --stage ${stage} --config ${config}  --conceal`. |
|DependsOn|Name of task or list of names|The tasks listed in this attribute will be executed before this task.|
|Skip| `true` or `false` |When `true` task (and dependent tasks) will not be executed.|
|TaskRoleName|string|Specifies the name of the IAM Role that must be used for cross account access. A role with this is expected to exist in the target account (and have the right AssumeRole permissions).|
|Parameters|any|Specifies parameters that must be passed to the serverless deployment using command arguments.|

**example**
```yaml
ServerlessWorkload:
  Type: update-serverless.com
  Config: serverless.yml
  Path: ./workload/
  Stage: dev
  Parameters:
    resourcePrefix: my
  OrganizationBinding:
    Account: !Ref AccountA
  MaxConcurrentStacks: 1
  FailedStackTolerance: 5
```

### copy-to-s3

The ``copy-to-s3`` task will upload a file from `LocalPath` to an S3 `RemotePath`.

|Attribute |Value|Remarks|
|:---|:---|:---|
|LocalPath|relative path|This property is required. <br/><br/>Specifies the file that needs to be uploaded.
|RemotePath|S3 moniker|This property is required. <br/><br/>Specifies the location in S3 that the file should be uploaded to.
|OrganizationBinding| [OrganizationBinding](#organizationbinding-where-to-create-which-resource)|This property is required. <br/><br/>Organization binding used to specify which accounts the s3 file needs to be copied to.|
|DependsOn|Name of task or list of names|The tasks listed in this attribute will be executed before this task.|
|Skip| `true` or `false` |When `true` task (and dependent tasks) will not be executed.|
|TaskRoleName|string|Specifies the name of the IAM Role that must be used for cross account access. A role with this is expected to exist in the target account (and have the right AssumeRole permissions).|

**example**
```yaml
CopyToS3:
  Type: copy-to-s3
  LocalPath: ./files/file.txt
  RemotePath: s3://my-bucket/files/file.txt
  OrganizationBinding:
    Account: !Ref AccountA
    Region: eu-central-1
```

### update-cdk

The ``update-cdk`` task will deploy the a CDK workload defined in the directory specified by `Path`.

|Attribute |Value|Remarks|
|:---|:---|:---|
|Path|relative path|This property is required. <br/><br/>Specifies which directory contains the serverless.com workload
|OrganizationBinding| [OrganizationBinding](#organizationbinding-where-to-create-which-resource)|This property is required. <br/><br/>Organization binding used to specify which accounts the CDK workload needs to be deployed to.|
|RunNpmInstall|boolean| When true, `npm ci` will be ran before CDK and removal|
|RunNpmBuild|boolean| When true, `npm run build` will be ran before CDK and removal|
|CustomDeployCommand| string | When specified will override the default command used when deploying a serverless.com workload. <br/><br/>default command is: `npm ci && npm run build && npx cdk deploy ${CurrentTask.Parameters} `. |
|CustomRemoveCommand| string | When specified will override the default command used when removing a CDK workload. <br/><br/>default command is: `npm ci && npm run build && npx cdk destroy ${CurrentTask.Parameters} `.|
|DependsOn|Name of task or list of names|The tasks listed in this attribute will be executed before this task.|
|Skip| `true` or `false` |When `true` task (and dependent tasks) will not be executed.|
|TaskRoleName|string|Specifies the name of the IAM Role that must be used for cross account access. A role with this is expected to exist in the target account (and have the right AssumeRole permissions).|
|Parameters|any|Specifies parameters that must be passed to the cdk deployment using `-c` arguments.|


**example**
```yaml
CdkWorkload:
  Type: update-cdk
  Path: ./workload/
  RunNpmInstall: true
  RunNpmBuild: true
  Parameters:
    resourcePrefix: my
  OrganizationBinding:
    Account: !Ref AccountA
  MaxConcurrentStacks: 1
  FailedStackTolerance: 5
```

### include

The ``include`` include another taskfile with tasks to be executed.

|Attribute |Value|Remarks|
|:---|:---|:---|
|DependsOn|Name of task or list of names|The tasks listed in this attribute will be executed before this task.|
|Skip| `true` or `false` |When `true` task (and dependent tasks) will not be executed.|
|Path|relative path|This property is required.<br/><br/> Specifies the Path of the taskfile that should be included.|
|MaxConcurrentTasks|number|The number of tasks within the imported file that should be executed concurrently.<br/><br/> Default = 1|
|FailedTaskTolerance|number|The number of failed tasks within the imported file that will cause the tasks to fail.<br/><br/> Default = 0|
|Parameters|any|Specifies values to parameters declared in the included taskfile. If not specified values passed to the current are passed to the included taskfile|

**example**
```yaml
Include:
  Type: include
  DependsOn: otherTask
  Path: ./build-tasks-include.yml
  MaxConcurrentTasks: 10
  FailedTaskTolerance: 10
  Parameters:
    resourcePrefix: my
```
