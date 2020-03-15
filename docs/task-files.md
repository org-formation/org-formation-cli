
<!-- @import "[TOC]" {cmd="toc" depthFrom=2 depthTo=6 orderedList=false} -->

<!-- code_chunk_output -->

- [Task types](#task-types)
  - [update-organization](#update-organization)
  - [update-stacks](#update-stacks)
  - [update-serverless.com](#update-serverlesscom)
  - [include](#include)

<!-- /code_chunk_output -->


# Automating deployments

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

``> org-formation perform-tasks taskfile.yml  [--profile my-aws-profile]``

For more info see the [cli reference](cli-reference.md)


## Task types

### update-organization

The ``update-organization`` task will update all the organization resources based on the template specified as ``Template``.

|Attribute |Value|Remarks|
|:---|:---|:---|
|Template|relative path|This property is required.|

### update-stacks

The `update-stacks` task will provision all resources in all accounts specified in  `Template`.

|Attribute |Value|Remarks|
|:---|:---|:---|
|Template|relative path|This property is required. <br/><br/>Specifies the Organization Formation template of which the resources must be updated
|DependsOn|Name of task or list of names|The tasks listed in this attribute will be executed before this task.|
|StackName|string|This property is required.<br/><br/>Specifies the name of the stack that will be created in all accounts/regions.|
|StackDescription|string|If specified, value will be set as the description of the created stacks<br/><br/> **note**:  This value overriddes values within the template or resources (value in taskfile is leading). |
|Parameters|Dictionary|Specifies parameters that must be used when executing the template.|
|OrganizationFile|relative path|Organization file used when executing templates.<br/><br/>**note**: This value overriddes values within the template or resources (value in taskfile is leading).<br/><br/> **note**: This value can also be used if template is plain CloudFormation.|
|TerminationProtection|true or false|If `true` termination protection will be enabled on all stacks created for this template|
|DefaultOrganizationBindingRegion|String or list of String|Region or regions that will be used for any binding without Region specified.<br/><br/> **note**:  This value overriddes values within the template or resources (value in taskfile is leading).<br/><br/> **note**: This value can also be used if template is plain CloudFormation.|
|DefaultOrganizationBinding|[OrganizationBinding](#organizationbinding-where-to-create-which-resource)| Organization binding used for any resource that has no binding specified.<br/><br/> **note**:  This value overriddes values within the template or resources (value in taskfile is leading). <br/><br/> **note**: This value can also be used if template is plain CloudFormation.|
|OrganizationBindings|Dictionary of Strign, [OrganizationBinding](#organizationbinding-where-to-create-which-resource)| Set of named OrganizationBindings that can be `!Ref`'d by Resources.<br/><br/> **note**: This value overriddes values within the template or resources (value in taskfile is leading).|

**example**
```yaml
BudgetAlarms:
  Type: update-stacks
  Template: ./budget-alarms.yml
  StackName: budget-alarms
  TerminationProtection: true
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

The ``update-serverless.com`` task will deploy the [serverless.com](https://serverless.com) workload defined in the directory specified as `Path`.


|Attribute |Value|Remarks|
|:---|:---|:---|
|Path|relative path|This property is required. <br/><br/>Specifies which directory contains the serverless.com workload
|OrganizationBinding| [OrganizationBinding](#organizationbinding-where-to-create-which-resource)|This property is required. <br/><br/>Organization binding used to specify which accounts the serverless.com workload needs to be deployed to.|
|Config| relative path |Name of the Serverless.com configuration file that contains information about the payload.<br/><br/>default is **./serverless.yml**|
|Stage|string|Value used as stage when deploying the serverless.com workload|
|DependsOn|Name of task or list of names|The tasks listed in this attribute will be executed before this task.|

**example**
```yaml
ServerlessWorkload:
  Type: update-serverless.com
  Config: serverless.yml
  Path: ./workload/
  Stage: dev
  OrganizationBinding:
    Account: !Ref AccountA
  MaxConcurrentStacks: 10
  FailedStackTolerance: 10
```

### include

The ``include`` include another taskfile with tasks to be executed.

|Attribute |Value|Remarks|
|:---|:---|:---|
|DependsOn|Name of task or list of names|The tasks listed in this attribute will be executed before this task.|
|Path|relative path|This property is required.<br/><br/> Specifies the Path of the taskfile that should be included.|
|MaxConcurrentTasks|number|The number of tasks within the imported file that should be executed concurrently.<br/><br/> Default = 1|
|FailedTaskTolerance|number|The number of failed tasks within the imported file that will cause the tasks to fail.<br/><br/> Default = 0|

**example**
```yaml
Include:
  Type: include
  DependsOn: otherTask
  Path: ./build-tasks-include.yml
  MaxConcurrentTasks: 10
  FailedTaskTolerance: 10
```

