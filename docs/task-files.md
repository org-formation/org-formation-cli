
- [Updating multiple templates at once](#updating-multiple-templates-at-once)
- [Task types](#task-types)
  - [update-organization](#update-organization)
  - [update-stacks](#update-stacks)
  - [include](#include)

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

``> org-formation perform-tasks taskfile.yml  [--profile my-aws-profile]``

For more info see the [cli reference](cli-reference.md)


## Task types

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

