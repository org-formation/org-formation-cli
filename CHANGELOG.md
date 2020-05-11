# Changelog
All notable changes to aws organization formation will be documented in this file.

**version 0.9.5**

- Added `StackPolicy` attribute to update-stacks tasks
- Added `UpdateProtection` attribute to update-stacks tasks and update stacks command.
- Added `Skip` attribute to any task (will skip task execution but continue, also with dependent tasks)
- Improved logging
- Added Parameter support to tasks file:
--  Parameters can be declared in `Parameters` section
--  Parameters can be used in `!Ref` and `!Sub` or as part of other expressions
- Added `!CopyValue` function to tasks file which can be used to reference to a stacks output.
- Added parameter support to CDK tasks
- Added parameter support to SLS tasks
- Improved profile configuration support.

**version 0.9.4**
- Added update-cdk task type to perform-tasks to support deployment of cdk workloads
- Added update-serverless.com task type to perform-tasks to support deployment of serverless.com workloads
- Added copy-to-s3 task type to perform-tasks to support uploading files to S3 as part of a build pipeline
- Added --organization-file to perform-tasks and validate-tasks command, can be used to specify the organization to be used when evaluating bindings (without having an update-organization task)
- Added TaskRoleName to update-stacks, update-serverless.com & copy-to-s3 tasks to support custom role for cross account access
- Added CloudFormationRoleName to update-stacks to pass specific role to CloudFormation

**version 0.9.3**
- Added flag --perform-cleanup to perform-tasks to automatically delete stacks removed from tasks file
- Added support for moving master account to OU
- Added support for multiple accounts that have the same account name

**version 0.9.2**
- Fixed issue with init-pipeline failing due to wrong option on codebuild script

**version 0.9.1**
- Added Support for expanding EnumTargetAccounts and EnumTargetRegions inside array
- Added Support for modeling nested Organizational Units
- OU bindings will include nested OU's
- Fixed issue with failed stacks tolerance on update-stacks
- Added option (--no-color) to disable colorization of log messages.
- Clear error message when generating organization.yaml for org with master account inside OU

**version 0.0.76**
- Fixed issue with validation of commandline input pararameters

**version 0.0.75**
- Added additional input validation

**version 0.0.74**
- Added support for further extending the account creation using CloudWatch / EventBridge events. See example: https://github.com/OlafConijn/AwsOrganizationFormation/tree/master/examples/automation/create-account

**version 0.0.73**
- Changed the default for max concurrent stacks (within a task, update or delete-stacks) to 1
- Added `--max-concurrent-stacks` and `--failed-stacks-tolerance` options
- Added attributes to update-stacks task to modify values for max-concurrancy and failure tolerance.
- When a tasks depends on a failed task it will be skipped automatically
- Added red to errors and yellow warnings to make 'm stand out more

**version 0.0.72**
- Fixed inconsistency in function naming scheme: using Fn:TargetCount will log a warning. Fn::TargetCount (2 colons) will not.

**version 0.0.71**
- Added SupportLevel attribute to accounts, which can be used to set the support subscription level (enterprise, business or developer) for the account.

**version 0.0.70**
- Modified init-pipeline command so it will include the template for codecommit/build/pipeline in the initial commit.
- Added descriptive error when !Ref on parameter.ExportAccountId cannot be resolved.
- Fixed bug where changing the logical name of MasterAccount resulted in invalid state.
- Changed the logical name of generated Foreach resources. Also added a very specific error with help how to resolve adverse effects of this on guardduty templates.

**version 0.0.69**
- Added --stack-trace flag to print stack traces for errors. stacktraces are now hidden by default.

**version 0.0.68**
- Added support for passing !Ref account in update-stacks parameters (tasks file).
- Added validation on the tasks in tasks file: top level file must have exactly 1 update-organization task
- Added validation on the tasks in tasks file: no 2 update-stacks tasks can have the same stackName

**version 0.0.67**
- Added support for empty/null bindings.
- Added Fn:TargetCount function which returns the amount of target for a binding. Can be used in Conditions, e.g: CreateResoruce: !Not [ !Equals [ Fn:TargetCount MyBinding, 0 ] ]

**version 0.0.65**
- Fixed issue where account creation had to be retried after timing issue accessing the account for the first time.
- When calling org-formation without args it will display help.

**version 0.0.64**
- Improved logic to select resource in cross target !Ref. If target resource exists in same account but different region AWSAccount.Resources.LogicalResourceId can now be used to refer to resource in different region.

**version 0.0.63**
- Fixed issue when deleting stacks state wasnt updated properly.

**version 0.0.62**
- Fixed issue with execute change set CLI command

**version 0.0.61**
- Added quite a bit of validation logic (notably to OrganizationalBindings and tasks)

**version 0.0.60**
- Ranamed Foreach to ForeachElement for resource foreach  (old attribute logs warning)

**version 0.0.59**
- Ranamed OrganizationBinding to DefaultOrganizationBinding in template (old attribute logs warning)
- Ranamed OrganizationBindingRegion to DefaultOrganizationBindingRegion in template (old attribute logs warning)
- Ranamed OrganizationBinding to DefaultOrganizationBinding in update-stack tasks (old attribute logs warning)
- Ranamed OrganizationBindingRegion to DefaultOrganizationBindingRegion in update-stack tasks (old attribute logs warning)

**version 0.0.58**
- Support for cross account dependencies with conditions (condition gets copied to export)

**version 0.0.56**
- Support for qouted expressions in EnumTargetRegions and EnumTargetAccounts, e.g. Fn::EnumTargetAccounts RoleAccountBinding 'arn:aws:iam::${account}:role/DeveloperRole'
- Support for adding OrganizationBindings in update-stack tasks.

**version 0.0.55**
- Support for toplevel OrganizationBindings section to list organization bindings
- Changed EnumTargetAccounts and EnumTargetRegions to only work with organization bindings from OrganizationBindings section

**version 0.0.54**
- Fixed issue with explicit cross account !Ref and !GetAtt to local account (e.g. !GetAtt AWSAccount.Resources.Topic.arn)

**version 0.0.53**
- Made --stack-name option optional on validate-stack and print-stack.
- Added --parameters option to print-stacks command. Doesnt really do anything but allows you to use the same options on validate-stack and print-stack.

**version 0.0.52**
- Added --parameters option to validate-stacks command.

**version 0.0.51**
- When running perform-tasks, having an update-organization task is now required. The organization file will be re-used and must be consistent with other tasks.

**version 0.0.50**
- Fixed a bug where cross account export values that were resolved where re-used on multiple target parameters

**version 0.0.49**
- Added validate tasks command (org-formation validate-tasks <task-file>)

**version 0.0.48**
- Added validate stacks command (org-formation validate-stacks <template-file>)
- Init-pipeline now reuses state bucket if already present.

**version 0.0.47**
- Fixed an issue where stacks wouldnt be able to get deleted after the account was closed. Stacks will now be forgotten if deletion fails.
